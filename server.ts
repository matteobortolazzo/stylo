import { StyloCompiler } from "./src/compiler/StyloCompiler.ts";

const PORT = 8080;
const INPUT_PATH = "./index.stylo";
const OUTPUT_PATH = "./index.html";

const compiler = new StyloCompiler();
compile();

const server = Deno.listen({ port: PORT });
console.log(`File server running on http://localhost:${PORT}/`);

const inputWatcher = Deno.watchFs(INPUT_PATH);
console.log('Watching input file for changes');

async function handleHttpConnections() { 
  for await (const conn of server) {
    handleHttp(conn).catch(console.error);
  }
}

async function handleInputChanges() {
  let timeout;
  for await (const ev of inputWatcher) {
    if (timeout || ev.kind === "access") continue;
    timeout = setTimeout(() => { timeout = null }, 500)
    console.log('File changed, recompiling...');
    compile();
  }
}

async function compile() {
  const input = await Deno.readTextFile(INPUT_PATH);
  const html = compiler.compile(input);
  await Deno.writeTextFile(OUTPUT_PATH, html!);
}

async function handleHttp(conn: Deno.Conn) {
  const httpConn = Deno.serveHttp(conn);
  for await (const requestEvent of httpConn) {

    // Use the request pathname as filepath
    const url = new URL(requestEvent.request.url);
    const filepath = decodeURIComponent(url.pathname);

    // Try opening the file
    let file;
    try {
      file = await Deno.open("." + filepath, { read: true });
    } catch {
      // If the file cannot be opened, return a "404 Not Found" response
      const notFoundResponse = new Response("404 Not Found", { status: 404 });
      await requestEvent.respondWith(notFoundResponse);
      continue;
    }

    // Build a readable stream so the file doesn't have to be fully loaded into
    // memory while we send it
    const readableStream = file.readable;

    // Build and send the response
    const response = new Response(readableStream);
    await requestEvent.respondWith(response);
  }
}

async function main() {
  try {
    await Promise.race([
      handleHttpConnections(),
      handleInputChanges(),
    ]);
  } catch (err) {
    console.error(err);
  }
}

main();

