import Center from "@/components/Center";
import Frame from "@/components/Frame";
import AuthForm from "@/components/AuthForm";

export default function JellyfinAuthPage() {
  return (
    <Frame
      title="Welcome to Jellywind"
      subheading="Log into your Jellyfin server to continue"
    >
      <Center isRow={false}>
        <AuthForm />
      </Center>
    </Frame>
  );
}
