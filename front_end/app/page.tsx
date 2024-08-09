import { getServerSession } from "next-auth/next";
import LoginButton from "@/components/LoginButton";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";

export default async function Home() {
  const session = await getServerSession(authOptions);

  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-24">
      <h1 className="text-4xl font-bold mb-8">Welcome to Chat App</h1>
      <LoginButton />
      {session && (
        <p className="mt-4">
          You're signed in. Click 'Go to Chat' to start chatting!
        </p>
      )}
    </main>
  );
}
