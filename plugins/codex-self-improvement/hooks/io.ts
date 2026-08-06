export async function readStdinText(stream: NodeJS.ReadStream = process.stdin): Promise<string> {
  return new Promise((resolve, reject) => {
    let data = "";
    stream.setEncoding("utf8");
    stream.on("data", (chunk) => {
      data += chunk;
    });
    stream.on("end", () => resolve(data));
    stream.on("error", (err) => reject(err));
  });
}

export function isMainModule(metaUrl: string, argv1: string | undefined = process.argv[1]): boolean {
  if (!argv1) return false;
  try {
    const normalizedArgv = argv1.startsWith("file://") ? argv1 : `file://${argv1}`;
    return metaUrl === normalizedArgv || metaUrl === new URL(`file://${argv1}`).href;
  } catch {
    return false;
  }
}
