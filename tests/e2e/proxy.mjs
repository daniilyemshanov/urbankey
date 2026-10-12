import http from "http";
// имитация Supabase: /rest/v1/* -> PostgREST (корень)
http.createServer((req, res) => {
  const p = req.url.replace(/^\/rest\/v1/, "");
  const up = http.request({ host: "localhost", port: 3100, path: p, method: req.method, headers: req.headers }, (r) => { res.writeHead(r.statusCode, r.headers); r.pipe(res); });
  req.pipe(up);
}).listen(3200);
