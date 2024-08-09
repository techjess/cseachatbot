import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session || !session.user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const id = params.id;
  const searchParams = req.nextUrl.searchParams;
  const page = parseInt(searchParams.get("page") as string) || 1;
  const limit = parseInt(searchParams.get("limit") as string) || 20;

  try {
    // First, check if the conversation belongs to the current user
    const conversation = await prisma.conversation.findFirst({
      where: { id: id, userId: session.user.id },
    });

    if (!conversation) {
      return NextResponse.json(
        { error: "Conversation not found" },
        { status: 404 }
      );
    }

    const messages = await prisma.message.findMany({
      where: { conversationId: id },
      orderBy: { createdAt: "desc" },
      take: limit,
      skip: (page - 1) * limit,
    });

    const totalMessages = await prisma.message.count({
      where: { conversationId: id },
    });

    return NextResponse.json({
      messages: messages.reverse(),
      currentPage: page,
      totalPages: Math.ceil(totalMessages / limit),
      hasMore: page * limit < totalMessages,
    });
  } catch (error) {
    console.error("Error fetching messages:", error);
    return NextResponse.json(
      { error: "Failed to fetch messages" },
      { status: 500 }
    );
  }
}
