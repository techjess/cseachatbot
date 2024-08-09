import { getProviders } from "next-auth/react";
import LoginButton from "@/components/LoginButton";

export default async function SignIn() {
  const providers = await getProviders();

  return (
    <div className="flex min-h-screen flex-col items-center justify-center p-24">
      <h1 className="text-4xl font-bold mb-8">Sign In</h1>
      {providers &&
        Object.values(providers).map((provider) => (
          <div key={provider.name}>
            <LoginButton />
          </div>
        ))}
    </div>
  );
}
