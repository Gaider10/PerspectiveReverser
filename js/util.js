/**
 *
 * @param {string} url
 * @returns {Promise<HTMLImageElement>}
 */
export async function loadImage(url) {
    return new Promise((resolve, reject) => {
        const image = new Image();
        image.crossOrigin = "anonymous";
        image.onload = () => {
            resolve(image);
        };
        image.onerror = () => {
            reject();
        };
        image.src = url;
    });
}

/**
 *
 * @param {string} str
 * @returns {Promise<void>}
 */
export async function copyToClipboard(str) {
    return navigator.clipboard.writeText(str).catch((e) => {
        console.log("navigator.clipboard.writeText() failed: ", e);

        var textArea = document.createElement("textarea");
        textArea.value = str;

        textArea.style.top = "0";
        textArea.style.left = "0";
        textArea.style.position = "fixed";

        document.body.appendChild(textArea);
        try {
            textArea.focus();
            textArea.select();

            if (!document.execCommand('copy')) {
                throw new Error("returned false")
            }
        } finally {
            document.body.removeChild(textArea);
        }
    }).catch((e) => {
        console.log("document.execCommand('copy') also failed: ", e);

        alert(str);
    });
}

/**
 * @param {Uint8Array} bytes
 * @returns {string}
 */
function encodeBase64(bytes) {
    return btoa(String.fromCharCode(...bytes));
}

/**
 * @param {string} str
 * @returns {Uint8Array}
 */
function decodeBase64(str) {
    return new Uint8Array(Array.from(atob(str)).map(c => c.charCodeAt(0)))
}

/**
 * @param {string} str
 * @returns {Promise<string>}
 */
export async function compress(str) {
    return encodeBase64(await new Response(new Blob([str]).stream().pipeThrough(new CompressionStream("deflate"))).bytes());
}

/**
 * @param {string} str
 * @returns {Promise<string>}
 */
export async function decompress(str) {
    return await new Response(new Blob([decodeBase64(str)]).stream().pipeThrough(new DecompressionStream("deflate"))).text();
}