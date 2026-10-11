import Link from "next/link";
import { Burst } from "@/components/comic/burst";
import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <div className="mx-auto flex max-w-xl flex-col items-center gap-6 px-4 py-20 text-center">
      <Burst className="size-44" color="bg-zap" textClassName="text-5xl text-white">
        404!
      </Burst>
      <h1 className="comic-title text-5xl">Lost in time!</h1>
      <p className="text-lg">
        This saga has vanished from the archives. If the server restarted without a database, unsaved sagas are lost.
      </p>
      <Button asChild size="lg">
        <Link href="/">Back to the present</Link>
      </Button>
    </div>
  );
}
