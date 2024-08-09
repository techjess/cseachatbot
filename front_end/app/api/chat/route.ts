import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";

const MAX_PROMPT_LENGTH = 4000; // Adjust this based on your LLM's token limit

function truncatePrompt(prompt: string, maxLength: number): string {
  if (prompt.length <= maxLength) return prompt;
  return prompt.slice(prompt.length - maxLength);
}

function formatPrompt(context: any[], newMessage: string): string {
  let prompt =
    "You are an AI assistant in a chat conversation. Respond to the user's latest message considering the following context:\n\n";

  context.forEach((msg) => {
    prompt += `${msg.role.toUpperCase()}: ${msg.content}\n`;
  });

  prompt += `USER: ${newMessage}\n`;
  prompt += "ASSISTANT: ";

  return truncatePrompt(prompt, MAX_PROMPT_LENGTH);
}

export async function POST(req: Request) {
  console.log("Received request in chat route");
  const session = await getServerSession(authOptions);
  if (!session || !session.user) {
    console.log("Not authenticated");
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const { message, conversationId, context } = await req.json();
  console.log("Received data:", { message, conversationId, context });

  try {
    let conversation;

    if (conversationId) {
      conversation = await prisma.conversation.findUnique({
        where: { id: conversationId },
        include: { user: true },
      });

      if (!conversation || conversation.userId !== session.user.id) {
        return NextResponse.json(
          { error: "Conversation not found or unauthorized" },
          { status: 404 }
        );
      }
    } else {
      conversation = await prisma.conversation.create({
        data: {
          userId: session.user.id,
          name: "New Conversation",
        },
      });
    }
    console.log("Received context:", context); // Add this line
    console.log("New message:", message); // Add this line
    // Format the prompt using the context and new message
    const formattedPrompt = formatPrompt(context, message);

    // Integrate with your LLM backend here
    console.log("Formatted prompt:", formattedPrompt);
    const llmResponse = await fetch("http://aicragnet.com:8088/chat", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        text: formattedPrompt,
        use_anthropic: false, // or true, depending on which model you want to use
      }),
    });

    if (!llmResponse.ok) {
      console.error(
        `LLM API error: ${llmResponse.status} ${llmResponse.statusText}`
      );
      const errorText = await llmResponse.text();
      console.error(`Error details: ${errorText}`);
      throw new Error(`LLM API responded with status: ${llmResponse.status}`);
    }

    const llmData = await llmResponse.json();
    const aiResponse = llmData.response;

    const userMessage = await prisma.message.create({
      data: {
        conversationId: conversation.id,
        content: message,
        sender: "user",
      },
    });

    const aiMessage = await prisma.message.create({
      data: {
        conversationId: conversation.id,
        content: aiResponse,
        sender: "ai",
      },
    });

    // Update the conversation's updatedAt timestamp
    await prisma.conversation.update({
      where: { id: conversation.id },
      data: { updatedAt: new Date() },
    });

    return NextResponse.json({
      conversationId: conversation.id,
      userMessage,
      aiMessage,
    });
  } catch (error) {
    console.error("Error:", error);
    return NextResponse.json(
      { error: "Failed to process message" },
      { status: 500 }
    );
  }
}
