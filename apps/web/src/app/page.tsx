import { SignedIn, SignedOut, SignInButton, UserButton } from "@clerk/nextjs";
import { Button } from "@spire/ui/button";
import styles from "./page.module.css";

export default function Home() {
  return (
    <div className={styles.page}>
      <main className={styles.main}>
        <h1>Spire</h1>
        <p>Real-time code sharing for instructors and students.</p>

        <div className={styles.authRow}>
          <SignedOut>
            <SignInButton mode="modal">
              <Button appName="web">Sign in with Clerk</Button>
            </SignInButton>
          </SignedOut>
          <SignedIn>
            <UserButton />
          </SignedIn>
        </div>
      </main>
    </div>
  );
}
