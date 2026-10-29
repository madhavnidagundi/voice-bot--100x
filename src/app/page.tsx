import { InterviewRoom } from "@/components/interview-room";
import { publicProfile } from "@/lib/profile";
export default function Home() {
  return <InterviewRoom profile={publicProfile} />;
}
