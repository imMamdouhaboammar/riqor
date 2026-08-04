import { expect, test } from "bun:test";
import { runProcess } from "../src/process";

async function expectProcessGone(pid: number) {
  expect(pid).toBeGreaterThan(0);
  for (let attempt = 0; attempt < 50; attempt += 1) {
    try { process.kill(pid, 0); } catch { return; }
    await Bun.sleep(10);
  }
  throw new Error(`detached descendant ${pid} survived cleanup`);
}

test("force-kills detached descendants that ignore graceful timeout termination", async () => {
  const started = performance.now();
  const result = await runProcess(
    [
      "bun",
      "-e",
      "const child=Bun.spawn(['bun', '-e', 'process.on(\\\"SIGTERM\\\",()=>{}); setInterval(()=>{},1000)'], { detached: true, stdout: 'ignore', stderr: 'ignore' }); console.log(child.pid); setInterval(()=>{},1000)",
    ],
    import.meta.dir,
    process.env,
    30,
    30,
  );
  expect(result.exitCode).toBe(124);
  expect(performance.now() - started).toBeLessThan(2_000);
  await expectProcessGone(Number(result.stdout.trim()));
});

test("cleans up a detached descendant after a successful parent exit", async () => {
  const result = await runProcess(
    [
      "bun",
      "-e",
      "const child=Bun.spawn(['bun', '-e', 'setInterval(()=>{},1000)'], { detached: true, stdout: 'ignore', stderr: 'ignore' }); child.unref(); console.log(child.pid)",
    ],
    import.meta.dir,
    process.env,
  );
  expect(result.exitCode).toBe(0);
  await expectProcessGone(Number(result.stdout.trim()));
});
