import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";

export async function PATCH(
  req: Request,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session || !session.user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const { name } = await req.json();

  try {
    const updatedConversation = await prisma.conversation.update({
      where: { id: params.id, userId: session.user.id },
      data: { name },
    });

    return NextResponse.json(updatedConversation);
  } catch (error) {
    console.error("Database error:", error);
    return NextResponse.json(
      { error: "Failed to update conversation" },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params;

    // First, delete all messages associated with the conversation
    await prisma.message.deleteMany({
      where: {
        conversationId: id,
      },
    });

    // Then, delete the conversation
    const deletedConversation = await prisma.conversation.delete({
      where: {
        id: id,
      },
    });

    return NextResponse.json(deletedConversation);
  } catch (error) {
    console.error("Error deleting conversation:", error);
    return NextResponse.json(
      { error: "Failed to delete conversation" },
      { status: 500 }
    );
  }
}
