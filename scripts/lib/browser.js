/**
 * Shared headless-Chrome launch settings for scripts that open game URLs.
 *
 * Game URLs come from contributors, so Chrome's sandbox and same-origin policy
 * stay ON. Set PUPPETEER_NO_SANDBOX=1 only on a throwaway CI machine that
 * cannot run the sandbox.
 */
import puppeteer from 'puppeteer';

export function launchArgs(viewport) {
    const args = [`--window-size=${viewport.width},${viewport.height}`, '--hide-scrollbars'];
    if (process.env.CI) {
        // CI runners have no GPU; let WebGL games render with SwiftShader.
        args.push('--use-angle=swiftshader', '--enable-unsafe-swiftshader');
    }
    if (process.env.PUPPETEER_NO_SANDBOX === '1') {
        args.push('--no-sandbox');
    }
    return args;
}

export function launchBrowser(viewport) {
    return puppeteer.launch({ headless: true, args: launchArgs(viewport) });
}

/** Some sites block "HeadlessChrome"; present as regular Chrome. */
export async function browserUserAgent(browser) {
    return (await browser.userAgent()).replace('HeadlessChrome', 'Chrome');
}
