/** `nibi dev` prints `Launcher URL: https://<tunnel>/dev/<user>/<session>/`; nothing else opens on the phone. */
const LAUNCHER_URL_RE = /^https:\/\/[^\s/]+\/dev\/[^\s/]+\/[^\s/]+\/$/;

export function isLauncherUrl(url: string): boolean {
	return LAUNCHER_URL_RE.test(url);
}

function escapeHtml(text: string): string {
	return text.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;');
}

/** A page with the QR to scan from the Launcher, plus the URL to paste when scanning fails. */
export function qrPage(url: string, svg: string): string {
	return `<!doctype html>
<html lang="vi"><head><meta charset="utf-8"><title>Nibi Launcher QR</title>
<style>body{font:18px system-ui,sans-serif;background:#fff;color:#1b2433;display:grid;place-items:center;min-height:100vh;margin:0}
main{text-align:center;max-width:520px;padding:24px}svg{width:360px;height:360px}code{word-break:break-all;font-size:14px}</style></head>
<body><main>
<h1>Quét bằng Nibi Launcher</h1>
<p>Mở Nibi Launcher trên điện thoại, bấm nút quét QR rồi hướng camera vào mã này.</p>
${svg}
<p>Không quét được? Dán link này vào ô nhập link của Launcher:</p>
<p><code>${escapeHtml(url)}</code></p>
</main></body></html>
`;
}
