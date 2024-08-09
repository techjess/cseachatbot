import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session || !session.user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  try {
    const { name } = await req.json();

    const newConversation = await prisma.conversation.create({
      data: {
        name: name || "New Conversation",
        userId: session.user.id,
      },
      include: {
        messages: true, // Include associated messages
      },
    });

    return NextResponse.json(newConversation);
  } catch (error) {
    console.error("Error creating new conversation:", error);
    return NextResponse.json(
      { error: "Failed to create new conversation" },
      { status: 500 }
    );
  }
}
