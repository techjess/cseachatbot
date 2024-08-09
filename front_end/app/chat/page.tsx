import { getServerSession } from "next-auth/next";
import { redirect } from "next/navigation";
import ChatInterface from "@/components/ChatInterface";
import prisma from "@/lib/prisma";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";

export default async function ChatPage() {
  const session = await getServerSession(authOptions);

  if (!session || !session.user) {
    redirect("/");
  }

  try {
    const conversations = await prisma.conversation.findMany({
      where: { userId: session.user.id },
      include: {
        messages: {
          orderBy: { createdAt: "asc" },
        },
      },
      orderBy: { updatedAt: "desc" },
    });

    return <ChatInterface initialConversations={conversations} />;
  } catch (error) {
    console.error("Failed to fetch conversations:", error);
    return (
      <div className="flex h-screen items-center justify-center">
        <p>Failed to load conversations. Please try again later.</p>
      </div>
    );
  }
}
