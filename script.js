const CONFIG = {
    doubleClickDelay: 250,
    mouseDragMin: 2,
    zoomIndexStep: 1,
    zoomIndexMin: -4,
    zoomIndexMax: 9,
    pointInnerRadius: 10,
    pointOuterRadius: 20,
    pointEdgeWidth: 2,
};

function project(constants, variables, frameIndex, worldPoint) {
    const [ offsetBy0_1, imageWidth, imageHeight, cameraYawSpeed, cameraPitchSpeed ] = constants;
    const [ cameraX, cameraY, cameraZ, cameraSpeedX, cameraSpeedY, cameraSpeedZ, cameraSpeedW, cameraSpeedF, cameraSpeedR, cameraYaw, cameraPitch, cameraFov, imageScale, screenHeight, screenMainFrameCenterDx, screenMainFrameCenterDy, screenFrameCenterSpeedX, screenFrameCenterSpeedY, screenZoomSpeed, ...times ] = variables;
    const time = times[frameIndex];

    const screenMainFrameHeight = imageHeight * imageScale;
    const screenFrameCenterDx = screenMainFrameCenterDx + screenFrameCenterSpeedX * time;
    const screenFrameCenterDy = screenMainFrameCenterDy + screenFrameCenterSpeedY * time;
    const imageToScreenZoom = (screenMainFrameHeight - screenZoomSpeed * time) / screenMainFrameHeight * imageScale;

    const sinYaw = Math.sin(cameraYaw + cameraYawSpeed * time);
    const cosYaw = Math.cos(cameraYaw + cameraYawSpeed * time);
    const sinPitch = Math.sin(-(cameraPitch + cameraPitchSpeed * time));
    const cosPitch = Math.cos(-(cameraPitch + cameraPitchSpeed * time));

    const f = 1 / Math.tan(cameraFov * 0.5);

    const [ x0, y0, z0 ] = worldPoint;

    // Translate by -camera_pos
    const x1 = x0 - (cameraX + cameraSpeedX * time);
    const y1 = y0 - (cameraY + cameraSpeedY * time);
    const z1 = z0 - (cameraZ + cameraSpeedZ * time);

    // Rotate around Y by yaw
    const x2 = x1 * cosYaw + z1 * sinYaw + cameraSpeedR * time;
    const y2 = y1;
    const z2 = x1 * -sinYaw + z1 * cosYaw + cameraSpeedW * time;
    
    // Rotate around X by -pitch
    const x3 = x2;
    const y3 = y2 * cosPitch + z2 * -sinPitch;
    const z3 = y2 * sinPitch + z2 * cosPitch + cameraSpeedF * time;

    const x4 = x3 * f;
    const y4 = y3 * f;
    // const z4 = z3 * zm + za;
    const w4 = -z3 + (offsetBy0_1 ? -0.1 : 0);
    
    const w4Inv = w4 === 0 ? 0 : 1 / w4;
    const x5 = (x4 * w4Inv * screenHeight * 0.5 - screenFrameCenterDx) / imageToScreenZoom + imageWidth / 2;
    const y5 = (y4 * w4Inv * screenHeight * 0.5 - screenFrameCenterDy) / imageToScreenZoom + imageHeight / 2;

    return [ x5, y5 ];
}

function projectedError(constants, variables, frames) {
    const [ offsetBy0_1, imageWidth, imageHeight, cameraYawSpeed, cameraPitchSpeed ] = constants;
    const [ cameraX, cameraY, cameraZ, cameraSpeedX, cameraSpeedY, cameraSpeedZ, cameraSpeedW, cameraSpeedF, cameraSpeedR, cameraYaw, cameraPitch, cameraFov, imageScale, screenHeight, screenMainFrameCenterDx, screenMainFrameCenterDy, screenFrameCenterSpeedX, screenFrameCenterSpeedY, screenZoomSpeed, ...times ] = variables;

    const screenMainFrameHeight = imageHeight * imageScale;

    const f = 1 / Math.tan(cameraFov * 0.5);

    let totalError = 0;
    let pointCount = 0;

    for (let frameIndex = 0; frameIndex < frames.length; frameIndex++) {
        const frame = frames[frameIndex];
        const time = times[frameIndex];

        const sinYaw = Math.sin(cameraYaw + cameraYawSpeed * time);
        const cosYaw = Math.cos(cameraYaw + cameraYawSpeed * time);
        const sinPitch = Math.sin(-(cameraPitch + cameraPitchSpeed * time));
        const cosPitch = Math.cos(-(cameraPitch + cameraPitchSpeed * time));

        const screenFrameCenterDx = screenMainFrameCenterDx + screenFrameCenterSpeedX * time;
        const screenFrameCenterDy = screenMainFrameCenterDy + screenFrameCenterSpeedY * time;
        const imageToScreenZoom = (screenMainFrameHeight - screenZoomSpeed * time) / screenMainFrameHeight * imageScale;

        for (let pointIndex = 0; pointIndex < frames[frameIndex].length; pointIndex++) {
            const [ x0, y0, z0 ] = frame[pointIndex][0];
            
            // Translate by -camera_pos
            const x1 = x0 - (cameraX + cameraSpeedX * time);
            const y1 = y0 - (cameraY + cameraSpeedY * time);
            const z1 = z0 - (cameraZ + cameraSpeedZ * time);
            
            // Rotate around Y by yaw
            const x2 = x1 * cosYaw + z1 * sinYaw + cameraSpeedR * time;
            const y2 = y1;
            const z2 = x1 * -sinYaw + z1 * cosYaw + cameraSpeedW * time;
            
            // Rotate around X by -pitch
            const x3 = x2;
            const y3 = y2 * cosPitch + z2 * -sinPitch;
            const z3 = y2 * sinPitch + z2 * cosPitch + cameraSpeedF * time;
    
            const x4 = x3 * f;
            const y4 = y3 * f;
            // const z4 = z3 * zm + za;
            const w4 = -z3 + (offsetBy0_1 ? -0.1 : 0);
            
            const w4Inv = w4 === 0 ? 0 : 1 / w4;
            const x5 = (x4 * w4Inv * screenHeight * 0.5 - screenFrameCenterDx) / imageToScreenZoom + imageWidth / 2;
            const y5 = (y4 * w4Inv * screenHeight * 0.5 - screenFrameCenterDy) / imageToScreenZoom + imageHeight / 2;
            
            const [ px, py ] = frame[pointIndex][1];
    
            const dpx = x5 - px;
            const dpy = y5 - py;
    
            const precision = frame[pointIndex][2];
            const error = (dpx * dpx + dpy * dpy) / (precision * precision);
    
            totalError += error;
            pointCount += 1;
        }
    }

    return totalError / pointCount;
}

/**
 * @typedef {(params: number[]) => number} ErrorFunc
 * @typedef {(paramValues: number[], paramLocks: boolean[], errorFunc: ErrorFunc, iteration: number) => number[]} DescentFunc
 */

/**
 * @type {DescentFunc}
 */
function gradientDescent(paramValues, paramLocks, errorFunc, iterations) {
    if (paramValues.length !== paramLocks.length) throw new Error("paramValues.length !== paramLocks.length");

    let params = Array.from(paramValues);
    let newParams = Array.from(paramValues);
    const deltas = Array(params.length).fill(0);

    let error = errorFunc(params);

    const deltaStep = 1e-6;
    
    for (let i = 0; i < iterations; i++) {
        let paramStep = 1e-1;

        for (let j = 0; j < params.length; j++) {
            if (!paramLocks[j]) {
                const tmp = params[j];
                params[j] += deltaStep;
                deltas[j] = errorFunc(params) - error;
                params[j] = tmp;
            }
        }

        let deltaLenSq = 0;
        for (let j = 0; j < params.length; j++) {
            deltaLenSq += deltas[j] ** 2;
        }
        const deltaLen = Math.sqrt(deltaLenSq);

        // console.log(`deltaLen ${deltaLen}`);

        if (deltaLen < 1e-12) {
            console.log(`deltaLen < 1e-12 at iteration ${i}`);
            break;
        }
        
        let newError;
        while (true) {
            for (let j = 0; j < params.length; j++) {
                newParams[j] = params[j] - deltas[j] / deltaLen * paramStep;
            }
            
            newError = errorFunc(newParams)
            if (newError <= error) break;

            paramStep *= 0.5;
        }

        if (paramStep < 1e-12) {
            console.log(`Stopped early at iteration ${i}`);
            break;
        }
        
        for (let j = 0; j < params.length; j++) {
            params[j] = newParams[j];
        }
        error = newError;
    }

    return params;
}


/**
 * @type {DescentFunc}
 */
function perParamDescent(paramValues, paramLocks, errorFunc, iterations) {
    if (paramValues.length !== paramLocks.length) throw new Error("variables.length !== variablesLocked.length");

    const params = Array.from(paramValues);
    const steps = paramLocks.map((locked) => locked ? 0 : 1);

    for (let i = 0; i < iterations; i++) {
        for (let j = 0; j < params.length; j++) {
            if (steps[j] === 0) continue;

            let minError = errorFunc(params);
            let minStepIndex = 0;

            for (let k = -1; k <= 1; k += 2) {
                const tmp = params[j];
                params[j] += steps[j] * k;
                const error = errorFunc(params);
                params[j] = tmp;
                if (error < minError) {
                    minError = error;
                    minStepIndex = k;
                }
            }

            if (minStepIndex === 0) {
                steps[j] *= 0.5;
            } else {
                params[j] = params[j] + steps[j] * minStepIndex;
            }
        }
    }

    return params;
}


/**
 * @type {DescentFunc}
 */
function randomDescent(paramValues, paramLocks, errorFunc, iterations) {
    if (paramValues.length !== paramLocks.length) throw new Error("variables.length !== variablesLocked.length");

    let params = Array.from(paramValues);
    let newParams = Array.from(paramValues);

    let error = errorFunc(params);

    for (let i = 0; i < iterations; i++) {
        let paramStep = (1 - i / iterations) * 1e-2;

        for (let j = 0; j < params.length; j++) {
            if (!paramLocks[j]) {
                newParams[j] = params[j] + (Math.random() - 0.5) * paramStep;
            }
        }
        
        let newError = errorFunc(newParams);

        if (newError <= error) {
            for (let j = 0; j < params.length; j++) {
                params[j] = newParams[j];
            }
            error = newError;
        }
    }

    return params;
}

/**
 * 
 * @param {number[]} constants 
 * @param {number[]} variablesInitial 
 * @param {boolean[]} variablesLocked 
 * @param {object} frames 
 * @param {DescentFunc} descentFunc 
 * @param {number} iterations 
 * @returns {number[]}
 */
function reverseProjection(constants, variablesInitial, variablesLocked, frames, descentFunc, iterations) {
    return descentFunc(variablesInitial, variablesLocked, (params) => projectedError(constants, params, frames), iterations);
}

/**
 * 
 * @param {string} url 
 * @returns {Promise<HTMLImageElement>}
 */
async function loadImage(url) {
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

window.addEventListener("load", () => {
    /**
     * @type {{
     *   imageNameLabel: HTMLLabelElement,
     *   timeInput: HTMLInputElement,
     *   timeLockedInput: HTMLInputElement,
     *   mainInput: HTMLInputElement,
     *   moveLeftButton: HTMLButtonElement,
     *   moveRightButton: HTMLButtonElement,
     *   canvas: HTMLCanvasElement,
     *   context: CanvasRenderingContext2D,
     *   image: HTMLImageElement,
     *   offscreenCanvas: OffscreenCanvas,
     *   offscreenContext: OffscreenCanvasRenderingContext2D,
     * }[]}
     */
    const frames = [];

    /**
     * @typedef {{
     *     wx: number,
     *     wy: number,
     *     wz: number,
     *     px: number,
     *     py: number,
     *     precision?: number,
     * }} Point
     */

    /**
     * @typedef {{
     *     points: number[],
     *     pixels: Pixel[],
     * }} Line
     */

    /**
     * @typedef {{
     *     px: number,
     *     py: number,
     *     filled: boolean,
     * }} Pixel
     */

    /**
     * @typedef {{
     *     frames: {
     *         name: string,
     *         time: number,
     *         timeLocked: boolean,
     *         points: Point[],
     *         lines: Line[],
     *     }[],
     *     mainFrameIndex: number | null,
     *     selectedPoint: [number, number] | null,
     *     selectedPointHistory: [number, number][],
     *     selectedLine: [number, number] | null,
     *     brightness: number,
     *     showGrid: boolean,
     *     showBlur: boolean,
     *     showProjected: boolean,
     *     offsetBy01: boolean,
     *     cameraX: number,
     *     cameraXLocked: boolean,
     *     cameraY: number,
     *     cameraYLocked: boolean,
     *     cameraZ: number,
     *     cameraZLocked: boolean,
     *     cameraSpeedX: number,
     *     cameraSpeedXLocked: boolean,
     *     cameraSpeedY: number,
     *     cameraSpeedYLocked: boolean,
     *     cameraSpeedZ: number,
     *     cameraSpeedZLocked: boolean,
     *     cameraSpeedW: number,
     *     cameraSpeedWLocked: boolean,
     *     cameraSpeedF: number,
     *     cameraSpeedFLocked: boolean,
     *     cameraSpeedR: number,
     *     cameraSpeedRLocked: boolean,
     *     cameraYaw: number,
     *     cameraYawLocked: boolean,
     *     cameraPitch: number,
     *     cameraPitchLocked: boolean,
     *     cameraYawSpeed: number,
     *     cameraPitchSpeed: number,
     *     cameraFov: number,
     *     cameraFovLocked: boolean,
     *     imageScale: number,
     *     imageScaleLocked: boolean,
     *     screenWidth: number,
     *     screenWidthLocked: boolean,
     *     screenHeight: number,
     *     screenHeightLocked: boolean,
     *     frameCenterDx: number,
     *     frameCenterDxLocked: boolean,
     *     frameCenterDy: number,
     *     frameCenterDyLocked: boolean,
     *     padLeftLocked: boolean,
     *     padRightLocked: boolean,
     *     padTopBottomLocked: boolean,
     *     zoomCenterSpeedX: number,
     *     zoomCenterSpeedXLocked: boolean,
     *     zoomCenterSpeedY: number,
     *     zoomCenterSpeedYLocked: boolean,
     *     zoomSpeed: number,
     *     zoomSpeedLocked: boolean,
     *     reversalMethod: "gradient" | "perparam" | "random",
     *     iterations: number,
     *     moveWorldX: number,
     *     moveWorldY: number,
     *     moveWorldZ: number,
     * }} State
     */

    /**
     * @type {State}
     */
    const defaultState = {
        frames: [],
        mainFrameIndex: null,
        selectedPoint: null,
        selectedPointHistory: [],
        selectedLine: null,
        brightness: 1,
        showGrid: false,
        showBlur: false,
        showProjected: false,
        offsetBy01: false,
        cameraX: 0,
        cameraXLocked: false,
        cameraY: 0,
        cameraYLocked: false,
        cameraZ: 0,
        cameraZLocked: false,
        cameraSpeedX: 0,
        cameraSpeedXLocked: true,
        cameraSpeedY: 0,
        cameraSpeedYLocked: true,
        cameraSpeedZ: 0,
        cameraSpeedZLocked: true,
        cameraSpeedW: 0,
        cameraSpeedWLocked: true,
        cameraSpeedF: 0,
        cameraSpeedFLocked: true,
        cameraSpeedR: 0,
        cameraSpeedRLocked: true,
        cameraYaw: 0,
        cameraYawLocked: false,
        cameraPitch: 0,
        cameraPitchLocked: false,
        cameraYawSpeed: 0,
        cameraPitchSpeed: 0,
        cameraFov: 70,
        cameraFovLocked: false,
        imageScale: 1,
        imageScaleLocked: true,
        screenWidth: 0,
        screenWidthLocked: true,
        screenHeight: 0,
        screenHeightLocked: true,
        frameCenterDx: 0,
        frameCenterDxLocked: true,
        frameCenterDy: 0,
        frameCenterDyLocked: true,
        padLeftLocked: false,
        padRightLocked: false,
        padTopBottomLocked: false,
        zoomCenterSpeedX: 0,
        zoomCenterSpeedXLocked: true,
        zoomCenterSpeedY: 0,
        zoomCenterSpeedYLocked: true,
        zoomSpeed: 0,
        zoomSpeedLocked: true,
        reversalMethod: "perparam",
        iterations: 1000,
        moveWorldX: 0,
        moveWorldY: 0,
        moveWorldZ: 0,
    };

    /**
     * @type {State}
     */
    let state = JSON.parse(JSON.stringify(defaultState));

    /**
     * @typedef {{
     *     emptySplitPath: number[],
     *     filledSplitPath: number[],
     * }} LineData
     */

    /**
     * @type {(LineData | null)[][]}
     */
    let linesData = [];

    let screenCanvasCenterDx = 0;
    let screenCanvasCenterDy = 0;
    let zoomIndex = 0;
    let screenToCanvasZoomMult = 1;
    
    /**
     * @type {HTMLDivElement}
     */
    const divFrames = document.getElementById("frames");

    const canvasClientWidth = 600;
    const canvasClientHeight = 400;

    let imageWidth = null;
    let imageHeight = null;

    /**
     * 
     * @param {any[]} arr 
     * @param {number} i 
     * @param {number} j 
     */
    function swap(arr, i, j) {
        const tmp = arr[i];
        arr[i] = arr[j];
        arr[j] = tmp;
    }

    /**
     * 
     * @param {number} num 
     * @param {number} i 
     * @param {number} j 
     * @returns {number}
     */
    function swapIndex(num, i, j) {
        if (num === i) return j;
        if (num === j) return i;
        return num;
    }
    
    /**
     * 
     * @param {number} frameIndex 
     */
    function updateFrameButtons(frameIndex) {
        const frame = frames[frameIndex];
        frame.moveLeftButton.disabled = frameIndex === 0;
        frame.moveRightButton.disabled = frameIndex === divFrames.children.length - 2;
    }

    function setMainFrame(frameIndex) {
        if (frameIndex === state.mainFrameIndex) return;

        if (frameIndex !== null && state.mainFrameIndex !== null) {
            const deltaTime = state.frames[frameIndex].time - state.frames[state.mainFrameIndex].time;

            const screenToCanvasTransformBefore = getToCanvasTransforms(frameIndex).screenToCanvasTransform;
    
            const sinYaw = Math.sin(state.cameraYaw * (Math.PI / 180));
            const cosYaw = Math.cos(state.cameraYaw * (Math.PI / 180));
            const sinPitch = Math.sin(state.cameraPitch * (Math.PI / 180));
            const cosPitch = Math.cos(state.cameraPitch * (Math.PI / 180));
    
            state.cameraX += (state.cameraSpeedX + state.cameraSpeedW * sinYaw - state.cameraSpeedF * sinYaw * cosPitch - state.cameraSpeedR * cosYaw) * deltaTime;
            state.cameraY += (state.cameraSpeedY + state.cameraSpeedF * sinPitch) * deltaTime;
            state.cameraZ += (state.cameraSpeedZ - state.cameraSpeedW * cosYaw + state.cameraSpeedF * cosYaw * cosPitch - state.cameraSpeedR * sinYaw) * deltaTime;

            state.cameraYaw += state.cameraYawSpeed * deltaTime;
            state.cameraPitch += state.cameraPitchSpeed * deltaTime;
    
            const screenMainFrameHeight = imageHeight * state.imageScale;
            const frameZoom = (screenMainFrameHeight - state.zoomSpeed * deltaTime) / screenMainFrameHeight;
            state.frameCenterDx += state.zoomCenterSpeedX * deltaTime;
            state.frameCenterDy += state.zoomCenterSpeedY * deltaTime;
            state.imageScale *= frameZoom;

            const screenToCanvasTransformAfter = getToCanvasTransforms(frameIndex).screenToCanvasTransform;

            const { x: canvasScreenXBefore, y: canvasScreenYBefore } = screenToCanvasTransformBefore.transformPoint(new DOMPoint(0, 0));
            const { x: canvasScreenXAfter, y: canvasScreenYAfter } = screenToCanvasTransformAfter.transformPoint(new DOMPoint(0, 0))
            const screenToCanvasZoomAfter = screenToCanvasTransformAfter.m11;

            screenCanvasCenterDx -= (canvasScreenXBefore - canvasScreenXAfter) / screenToCanvasZoomAfter;
            screenCanvasCenterDy -= (canvasScreenYBefore - canvasScreenYAfter) / screenToCanvasZoomAfter;
        }

        state.mainFrameIndex = frameIndex;
    }

    /**
     * 
     */
    function addFrame() {
        const frameDiv = document.createElement("div");
        frameDiv.classList.add("frame");

        const frameImageDiv = document.createElement("div");
        const frameImageLabel = document.createElement("label");
        frameImageLabel.innerText = "Frame image:";
        frameImageDiv.appendChild(frameImageLabel);
        frameImageDiv.appendChild(new Text(" "));
        const chooseImageButton = document.createElement("button");
        chooseImageButton.innerText = "Choose image";
        chooseImageButton.addEventListener("click", () => {
            imageInput.click();
        });
        frameImageDiv.appendChild(chooseImageButton);
        frameImageDiv.appendChild(new Text(" "));
        const imageNameLabel = document.createElement("label");
        frameImageDiv.appendChild(imageNameLabel);
        const imageInput = document.createElement("input");
        imageInput.type = "file";
        imageInput.accept = "image/*";
        imageInput.style.display = "none";
        imageInput.addEventListener("change", () => {
            if (imageInput.files.length === 0) return;
    
            const file = imageInput.files.item(0);
            const url = URL.createObjectURL(file);
            
            loadImage(url).then((image) => {
                const frameIndex = frames.indexOf(frame);
                if (setFrameImage(frameIndex, image, file.name)) {
                    requestRedraw();
                } else {
                    alert("All frames must have the same resolution");
                }
            }).catch(() => {
                alert("Failed loading image");
            }).finally(() => {
                URL.revokeObjectURL(url);
            });

            imageInput.value = "";
        });
        frameImageDiv.appendChild(imageInput);
        frameDiv.appendChild(frameImageDiv);

        const frameOptionsDiv = document.createElement("div");
        frameOptionsDiv.classList.add("frame-options");
        frameOptionsDiv.classList.add("multiframe-only");
        const frameTimeDiv = document.createElement("div");
        const frameTimeLabel = document.createElement("label");
        frameTimeLabel.innerText = "Time:";
        frameTimeDiv.appendChild(frameTimeLabel);
        frameTimeDiv.appendChild(new Text(" "));
        const frameTimeInput = document.createElement("input");
        frameTimeInput.type = "number";
        initCoordsInputs([ frameTimeInput ], (values) => {
            const frameIndex = frames.indexOf(frame);
            [ state.frames[frameIndex].time ] = values;

            requestRedraw();
        });
        frameTimeDiv.appendChild(frameTimeInput);
        const frameTimeLockedInput = document.createElement("input");
        frameTimeLockedInput.type = "checkbox";
        frameTimeLockedInput.addEventListener("change", (event) => {
            const frameIndex = frames.indexOf(frame);
            state.frames[frameIndex].timeLocked = frameTimeLockedInput.checked;

            requestRedraw();
        });
        frameTimeDiv.appendChild(frameTimeLockedInput);
        frameOptionsDiv.appendChild(frameTimeDiv);
        const frameMainRadioDiv = document.createElement("div");
        const frameMainRadioLabel = document.createElement("label");
        frameMainRadioLabel.appendChild(new Text("Main:"));
        const frameMainRadioInput = document.createElement("input");
        frameMainRadioInput.type = "radio";
        frameMainRadioInput.name = "mainFrameRadio";
        frameMainRadioInput.addEventListener("change", () => {
            if (frameMainRadioInput.checked) {
                const frameIndex = frames.indexOf(frame);
                if (state.mainFrameIndex !== frameIndex) {
                    setMainFrame(frameIndex);
                    
                    requestRedraw();
                }
            }
            
        });
        frameMainRadioLabel.appendChild(frameMainRadioInput);
        frameMainRadioDiv.appendChild(frameMainRadioLabel);
        frameOptionsDiv.appendChild(frameMainRadioDiv);
        frameDiv.appendChild(frameOptionsDiv);

        const canvas = document.createElement("canvas");
        canvas.classList.add("frame-canvas");
        frameDiv.appendChild(canvas);

        const frameFooterDiv = document.createElement("div");
        frameFooterDiv.classList.add("frame-footer");
        const moveLeftButton = document.createElement("button")
        moveLeftButton.innerText = "<";
        moveLeftButton.addEventListener("click", () => {
            moveFrame(frames.indexOf(frame), false);
        });
        frameFooterDiv.appendChild(moveLeftButton);
        const removeButton = document.createElement("button")
        removeButton.innerText = "X";
        removeButton.addEventListener("click", () => {
            removeFrame(frames.indexOf(frame));

            requestRedraw();
        });
        frameFooterDiv.appendChild(removeButton);
        const moveRightButton = document.createElement("button")
        moveRightButton.innerText = ">";
        moveRightButton.addEventListener("click", () => {
            moveFrame(frames.indexOf(frame), true);
        });
        frameFooterDiv.appendChild(moveRightButton);
        frameDiv.appendChild(frameFooterDiv);

        divFrames.insertBefore(frameDiv, divFrames.children[divFrames.children.length - 1]);

        canvas.tabIndex = -1;

        const context = canvas.getContext("2d");

        const offscreenCanvas = new OffscreenCanvas(0, 0);
        const offscreenContext = offscreenCanvas.getContext("2d", { willReadFrequently: true });
        
        const frame = {
            imageNameLabel,
            timeInput: frameTimeInput,
            timeLockedInput: frameTimeLockedInput,
            mainInput: frameMainRadioInput,
            moveLeftButton,
            moveRightButton,
            canvas,
            context,
            image: null,
            offscreenCanvas,
            offscreenContext,
        };
        frames.push(frame);

        state.frames.push({
            name: "",
            time: 0,
            timeLocked: true,
            points: [],
            lines: [],
        });
        const frameIndex = frames.length - 1;
        linesData.push([]);
        if (state.mainFrameIndex === null) {
            setMainFrame(frameIndex);
        }

        divFrames.scrollTo(divFrames.scrollWidth, 0);

        updateFrameButtons(frameIndex);
        if (frameIndex !== 0) updateFrameButtons(frameIndex - 1);
        
        let prevMouseDownCanvasPos = null;
        let prevMouseUpCanvasPos = null;
        let mouseDragging = false;
        let draggedPointIndex = null;
        let draggedPointCanvasOffsetX = 0;
        let draggedPointCanvasOffsetY = 0;
        let doubleClickStartTime = 0;

        canvas.addEventListener("mousedown", (event) => {
            if (frame.image === null) return;
            
            event.preventDefault();
            
            canvas.focus();
            
            if (prevMouseDownCanvasPos !== null) return;

            const mouseCanvasX = event.offsetX;
            const mouseCanvasY = event.offsetY;

            // console.log(`mousedown`);
            // console.log(`mouseCanvasPos: ${mouseCanvasX} ${mouseCanvasY}`);
            
            const frameIndex = frames.indexOf(frame);

            // const canvasToFrameTransform = getFrameToCanvasTransform(frameIndex)[1].invertSelf();
            // const { x: mouseFrameX, y: mouseFrameY } = canvasToFrameTransform.transformPoint(new DOMPoint(mouseCanvasX, mouseCanvasY));
            // console.log(`mouseFramePos: ${mouseFrameX} ${mouseFrameY}`);

            if (!event.shiftKey && Date.now() - doubleClickStartTime <= CONFIG.doubleClickDelay && prevMouseUpCanvasPos !== null) {
                const mouseCanvasDx = mouseCanvasX - prevMouseUpCanvasPos.x;
                const mouseCanvasDy = mouseCanvasY - prevMouseUpCanvasPos.y;
                const mouseCanvasDsq = mouseCanvasDx * mouseCanvasDx + mouseCanvasDy * mouseCanvasDy;
                if (mouseCanvasDsq <= CONFIG.mouseDragMin * CONFIG.mouseDragMin) {
                    let wx = 0;
                    let wy = 0;
                    let wz = 0;
                    if (state.selectedPointHistory.length !== 0) {
                        const lastSelectedPoint = state.selectedPointHistory[state.selectedPointHistory.length - 1];
                        const point = state.frames[lastSelectedPoint[0]].points[lastSelectedPoint[1]];
                        wx = point.wx;
                        wy = point.wy;
                        wz = point.wz;
                    }

                    // console.log(`doubleclick`);

                    if (selectLine(null)) {
                        const canvasToFrameTransform = getToCanvasTransforms(frameIndex).frameToCanvasTransform.invertSelf();
                        const { x: mouseFrameX, y: mouseFrameY } = canvasToFrameTransform.transformPoint(new DOMPoint(mouseCanvasX, mouseCanvasY));
                        // console.log(`mouseFramePos: ${mouseFrameX} ${mouseFrameY}`);
                        const roundedMouseFrameX = roundTo(roundTo(mouseFrameX, 1 / canvasToFrameTransform.m11), 1000);
                        const roundedMouseFrameY = roundTo(roundTo(mouseFrameY, 1 / canvasToFrameTransform.m22), 1000);
                        // console.log(`roundedMouseFramePos: ${roundedMouseFrameX} ${roundedMouseFrameY}`);

                        selectPoint(frameIndex, createPoint(frameIndex, wx, wy, wz, roundedMouseFrameX, roundedMouseFrameY));

                        requestRedraw();
                    }
                }
            }

            draggedPointIndex = null;

            let minDsq = Number.MAX_VALUE;

            for (let pointIndex = 0; pointIndex < state.frames[frameIndex].points.length; pointIndex++) {
                const canBeDragged =
                    (state.selectedPoint !== null && state.selectedPoint[0] === frameIndex && state.selectedPoint[1] === pointIndex) ||
                    (state.selectedLine !== null && state.selectedLine[0] === frameIndex && state.frames[state.selectedLine[0]].lines[state.selectedLine[1]].points.includes(pointIndex));
                if (!canBeDragged) continue;

                const point = state.frames[frameIndex].points[pointIndex];

                const pointFrameX = point.px;
                const pointFrameY = point.py;

                // console.log(`pointFramePos: ${pointFrameX} ${pointFrameY}`);

                const frameToCanvasTransform = getToCanvasTransforms(frameIndex).frameToCanvasTransform;
                const { x: pointCanvasX, y: pointCanvasY } = frameToCanvasTransform.transformPoint(new DOMPoint(pointFrameX, pointFrameY));

                // console.log(`pointCanvasPos: ${pointCanvasX} ${pointCanvasY}`);

                const canvasDx = pointCanvasX - mouseCanvasX;
                const canvasDy = pointCanvasY - mouseCanvasY;
                const canvasDsq = canvasDx * canvasDx + canvasDy * canvasDy;

                if (canvasDsq < CONFIG.pointOuterRadius * CONFIG.pointOuterRadius && canvasDsq < minDsq) {
                    minDsq = canvasDsq;
                    draggedPointIndex = pointIndex;
                    draggedPointCanvasOffsetX = canvasDx;
                    draggedPointCanvasOffsetY = canvasDy;
                }
            }

            prevMouseDownCanvasPos = {
                x: mouseCanvasX,
                y: mouseCanvasY,
            };
            doubleClickStartTime = Date.now();
        });

        canvas.addEventListener("contextmenu", (event) => {
            event.preventDefault();
        });

        window.addEventListener("mouseup", (event) => {
            if (frame.image === null) return;
            
            if (prevMouseDownCanvasPos === null) return;
            
            const mouseCanvasX = event.offsetX;
            const mouseCanvasY = event.offsetY;

            // console.log(`mouseup`);
            // console.log(`mouseCanvasPos: ${mouseCanvasX} ${mouseCanvasY}`);

            if (!mouseDragging) {
                const frameIndex = frames.indexOf(frame);
                
                let minPointDistSq = Number.MAX_VALUE;
                let clickedPointIndex = null;
                
                for (let pointIndex = 0; pointIndex < state.frames[frameIndex].points.length; pointIndex++) {
                    const point = state.frames[frameIndex].points[pointIndex];

                    const pointFrameX = point.px;
                    const pointFrameY = point.py;

                    // console.log(`pointFramePos: ${pointFrameX} ${pointFrameY}`);

                    const frameToCanvasTransform = getToCanvasTransforms(frameIndex).frameToCanvasTransform;
                    const { x: pointCanvasX, y: pointCanvasY } = frameToCanvasTransform.transformPoint(new DOMPoint(pointFrameX, pointFrameY));

                    // console.log(`pointCanvasPos: ${pointCanvasX} ${pointCanvasY}`);

                    let radius;
                    if (state.selectedPoint !== null && state.selectedPoint[0] === frameIndex && state.selectedPoint[1] === pointIndex) {
                        radius = CONFIG.pointOuterRadius;
                    } else if (state.selectedLine !== null && state.selectedLine[0] === frameIndex && state.frames[state.selectedLine[0]].lines[state.selectedLine[1]].points.includes(pointIndex)) {
                        radius = CONFIG.pointOuterRadius - (CONFIG.pointOuterRadius - CONFIG.pointInnerRadius) / 2;
                    } else {
                        radius = CONFIG.pointInnerRadius + CONFIG.pointEdgeWidth;
                    }

                    const canvasDx = pointCanvasX - mouseCanvasX;
                    const canvasDy = pointCanvasY - mouseCanvasY;
                    const canvasDsq = canvasDx * canvasDx + canvasDy * canvasDy;
                    
                    if (canvasDsq <= radius * radius && canvasDsq < minPointDistSq) {
                        minPointDistSq = canvasDsq;
                        clickedPointIndex = pointIndex;
                    }
                }
                
                if (clickedPointIndex !== null) {
                    if (event.shiftKey) {
                        selectPoint(null);

                        if (state.selectedLine === null) {
                            selectLine(frameIndex, createLine(frameIndex));
                        }
                        
                        toggleLinePoint(frameIndex, state.selectedLine[1], clickedPointIndex);
                    } else {
                        if (selectLine(null)) {
                            selectPoint(frameIndex, clickedPointIndex);
                        }
                    }
                } else {
                    const canvasToFrameTransform = getToCanvasTransforms(frameIndex).frameToCanvasTransform.invertSelf();
                    const { x: mouseFrameX, y: mouseFrameY } = canvasToFrameTransform.transformPoint(new DOMPoint(mouseCanvasX, mouseCanvasY));

                    let minLineDist = Number.MAX_VALUE;
                    let clickedLineIndex = null;

                    for (let lineIndex = 0; lineIndex < state.frames[frameIndex].lines.length; lineIndex++) {
                        const abc = calculateBestLineABCNorm(frameIndex, lineIndex);
                        if (abc === null) continue;

                        const lineDist = Math.abs(abc.a * mouseFrameX + abc.b * mouseFrameY + abc.c);
                        if (lineDist < 5 * Math.abs(canvasToFrameTransform.m11) && lineDist < minLineDist) {
                            minLineDist = lineDist;
                            clickedLineIndex = lineIndex;
                        }
                    }

                    if (clickedLineIndex !== null && !event.shiftKey) {
                        if (selectLine(frameIndex, clickedLineIndex)) {
                            selectPoint(null);
                        }
                    } else {
                        if (event.shiftKey) {
                            const pixelPx = Math.floor(mouseFrameX);
                            const pixelPy = Math.floor(mouseFrameY);
            
                            selectPoint(null);

                            if (state.selectedLine === null || state.selectedLine[0] !== frameIndex) {
                                selectLine(frameIndex, createLine(frameIndex));
                            }

                            toggleLinePixel(state.selectedLine[0], state.selectedLine[1], pixelPx, pixelPy);
                        } else {
                            selectPoint(null);
                            selectLine(null);
                        }
                    }
                }

                requestRedraw();
            }

            prevMouseDownCanvasPos = null;
            prevMouseUpCanvasPos = {
                x: mouseCanvasX,
                y: mouseCanvasY,
            };
            mouseDragging = false;
            draggedPointIndex = null;
        });

        canvas.addEventListener("mousemove", (event) => {
            if (frame.image === null) return;

            event.preventDefault();

            const mouseCanvasX = event.offsetX;
            const mouseCanvasY = event.offsetY;

            if (!mouseDragging && prevMouseDownCanvasPos !== null) {
                const mouseCanvasDx = mouseCanvasX - prevMouseDownCanvasPos.x;
                const mouseCanvasDy = mouseCanvasY - prevMouseDownCanvasPos.y;
                const mouseCanvasDsq = mouseCanvasDx * mouseCanvasDx + mouseCanvasDy * mouseCanvasDy;

                if (mouseCanvasDsq > CONFIG.mouseDragMin * CONFIG.mouseDragMin) {
                    mouseDragging = true;
                    doubleClickStartTime = 0;
                }
            }

            if (mouseDragging) {
                const mouseCanvasDx = mouseCanvasX - prevMouseDownCanvasPos.x;
                const mouseCanvasDy = mouseCanvasY - prevMouseDownCanvasPos.y;

                const frameIndex = frames.indexOf(frame);
                const { screenToCanvasTransform, frameToCanvasTransform } = getToCanvasTransforms(frameIndex);

                if (draggedPointIndex !== null) {
                    const newPointCanvasX = mouseCanvasX + draggedPointCanvasOffsetX;
                    const newPointCanvasY = mouseCanvasY + draggedPointCanvasOffsetY;
                    
                    const canvasToFrameTransform = frameToCanvasTransform.invertSelf();
                    const { x: newPointFrameX, y: newPointFrameY } = canvasToFrameTransform.transformPoint(new DOMPoint(newPointCanvasX, newPointCanvasY));
                    const roundedNewPointFrameX = roundTo(roundTo(newPointFrameX, 1 / canvasToFrameTransform.m11), 1000);
                    const roundedNewPointFrameY = roundTo(roundTo(newPointFrameY, 1 / canvasToFrameTransform.m22), 1000);

                    movePointProjected(frameIndex, draggedPointIndex, roundedNewPointFrameX, roundedNewPointFrameY);
                } else {
                    const screenToCanvasZoom = screenToCanvasTransform.m11;

                    screenCanvasCenterDx -= mouseCanvasDx / screenToCanvasZoom;
                    screenCanvasCenterDy -= mouseCanvasDy / screenToCanvasZoom;
                }
                
                prevMouseDownCanvasPos = {
                    x: mouseCanvasX,
                    y: mouseCanvasY,
                };

                requestRedraw();
            }
        });

        canvas.addEventListener("wheel", (event) => {
            if (event.shiftKey) return;

            if (frame.image === null) return;
            
            event.preventDefault();

            const mouseCanvasX = event.offsetX;
            const mouseCanvasY = event.offsetY;

            const frameIndex = frames.indexOf(frame);
            const { screenToCanvasTransform, frameToCanvasTransform } = getToCanvasTransforms(frameIndex);

            const screenToCanvasZoom = screenToCanvasTransform.m11;

            const prevZoomMult = screenToCanvasZoomMult;
            zoomIndex = Math.min(Math.max(zoomIndex + Math.sign(-event.deltaY) * CONFIG.zoomIndexStep, CONFIG.zoomIndexMin), CONFIG.zoomIndexMax);
            screenToCanvasZoomMult = Math.pow(2, zoomIndex);
            screenCanvasCenterDx += (mouseCanvasX - canvas.clientWidth / 2) * (1 / screenToCanvasZoom - 1 / (screenToCanvasZoom * screenToCanvasZoomMult / prevZoomMult));
            screenCanvasCenterDy += (mouseCanvasY - canvas.clientHeight / 2) * (1 / screenToCanvasZoom - 1 / (screenToCanvasZoom * screenToCanvasZoomMult / prevZoomMult));
            if (mouseDragging && draggedPointIndex !== null) {
                const frameIndex = frames.indexOf(frame);

                const newPointCanvasX = mouseCanvasX + draggedPointCanvasOffsetX;
                const newPointCanvasY = mouseCanvasY + draggedPointCanvasOffsetY;

                const canvasToFrameTransform = frameToCanvasTransform.invertSelf();
                const { x: newPointFrameX, y: newPointFrameY } = canvasToFrameTransform.transformPoint(new DOMPoint(newPointCanvasX, newPointCanvasY));
                const roundedNewPointFrameX = roundTo(roundTo(newPointFrameX, 1 / canvasToFrameTransform.m11), 1000);
                const roundedNewPointFrameY = roundTo(roundTo(newPointFrameY, 1 / canvasToFrameTransform.m22), 1000);

                movePointProjected(frameIndex, draggedPointIndex, roundedNewPointFrameX, roundedNewPointFrameY);
            }

            requestRedraw();
        }, {
            passive: false,
        });

        canvas.addEventListener("keydown", (event) => {
            if (frame.image !== null)  {
                if (state.selectedPoint !== null || state.selectedLine !== null) {
                    if (event.key === "Backspace" || event.key === "Delete") {
                        event.preventDefault();
        
                        if (state.selectedPoint !== null) {
                            removePoint(state.selectedPoint[0], state.selectedPoint[1]);
                        } else {
                            removeLine(state.selectedLine[0], state.selectedLine[1]);
                        }
        
                        requestRedraw();
                    }
                }

                if (state.selectedPoint !== null) {
                    for (const [key, dsx, dsy] of [["ArrowDown", 0, 1], ["ArrowUp", 0, -1], ["ArrowRight", 1, 0], ["ArrowLeft", -1, 0]]) {
                        if (event.key === key) {
                            event.preventDefault();
        
                            const point = state.frames[state.selectedPoint[0]].points[state.selectedPoint[1]];

                            const canvasToFrameTransform = getToCanvasTransforms(frameIndex).frameToCanvasTransform.invertSelf();
        
                            const newPointFrameX = roundTo(roundTo(point.px + dsx * canvasToFrameTransform.m11, 1 / canvasToFrameTransform.m11), 1000);
                            const newPointFrameY = roundTo(roundTo(point.py + dsy * canvasToFrameTransform.m22, 1 / canvasToFrameTransform.m22), 1000);
        
                            movePointProjected(state.selectedPoint[0], state.selectedPoint[1], newPointFrameX, newPointFrameY);
        
                            requestRedraw();
                        }
                    }
                }
            }
        });
    }

    addFrame();

    /**
     * 
     * @param {number} frameIndex 
     * @param {boolean} right 
     */
    function moveFrame(frameIndex, right) {
        if (frameIndex === 0 && !right || frameIndex === divFrames.children.length - 1 && right) return;

        divFrames.insertBefore(divFrames.children[frameIndex], divFrames.children[right ? frameIndex + 2 : frameIndex - 1]);

        const otherFrameIndex = right ? frameIndex + 1 : frameIndex - 1;

        swap(frames, frameIndex, otherFrameIndex);

        updateFrameButtons(frameIndex);
        updateFrameButtons(otherFrameIndex);

        swap(state.frames, frameIndex, otherFrameIndex);
        state.mainFrameIndex = swapIndex(state.mainFrameIndex, frameIndex, otherFrameIndex);
        if (state.selectedPoint !== null) {
            state.selectedPoint[0] = swapIndex(state.selectedPoint[0], frameIndex, otherFrameIndex);
        }
        for (const point of state.selectedPointHistory) {
            point[0] = swapIndex(point[0], frameIndex, otherFrameIndex);
        }
        if (state.selectedLine !== null) {
            state.selectedLine[0] = swapIndex(state.selectedLine[0], frameIndex, otherFrameIndex);
        }
        swap(linesData, frameIndex, otherFrameIndex);
    }

    /**
     * 
     * @param {number} frameIndex 
     */
    function removeFrame(frameIndex) {
        if (state.mainFrameIndex === frameIndex) {
            setMainFrame(state.mainFrameIndex + 1 < state.frames.length ? state.mainFrameIndex + 1 : state.mainFrameIndex > 0 ? state.mainFrameIndex - 1 : null);
        }

        divFrames.removeChild(divFrames.children[frameIndex]);
        frames.splice(frameIndex, 1);
        if (frames.length !== 0) {
            updateFrameButtons(0);
            updateFrameButtons(frames.length - 1);
        }

        for (let pointIndex = state.frames[frameIndex].points.length - 1; pointIndex >= 0; pointIndex--) {
            removePoint(frameIndex, pointIndex);
        }
        for (let lineIndex = state.frames[frameIndex].lines.length - 1; lineIndex >= 0; lineIndex--) {
            removeLine(frameIndex, lineIndex);
        }
        state.frames.splice(frameIndex, 1);
        if (state.mainFrameIndex !== null && state.mainFrameIndex > frameIndex) {
            state.mainFrameIndex -= 1;
        }
        linesData.splice(frameIndex, 1);
    }

    /**
     * 
     * @param {number} frameIndex 
     * @param {HTMLImageElement} image 
     * @param {string} name 
     * @returns {boolean}
     */
    function setFrameImage(frameIndex, image, name) {
        if (image !== null) {
            for (let i = 0; i < frames.length; i++) {
                if (i == frameIndex) continue;
    
                if (frames[i].image === null) continue;
    
                if (frames[i].image.width !== image.width || frames[i].image.height !== image.height) {
                    return false;
                }
            }
        }

        frames[frameIndex].image = image;
        
        state.frames[frameIndex].name = name;

        const prevImageWidth = imageWidth;
        const prevImageHeight = imageHeight;

        imageWidth = null;
        imageHeight = null;
        for (let i = 0; i < frames.length; i++) {
            if (frames[i].image !== null) {
                imageWidth = frames[i].image.width;
                imageHeight = frames[i].image.height;
                break;
            }
        }

        if (imageWidth !== null && (prevImageWidth !== imageWidth || prevImageHeight !== imageHeight)) {
            if (state.screenWidth === 0 || state.screenHeight === 0) {
                state.screenWidth = state.imageScale * imageWidth;
                state.screenHeight = state.imageScale * imageHeight;
            }

            screenCanvasCenterDx = 0;
            screenCanvasCenterDy = 0;
            zoomIndex = Math.min(Math.max(-Math.ceil(Math.log2(Math.max(imageWidth / canvasClientWidth, imageHeight / canvasClientHeight)) * 2) / 2, CONFIG.zoomIndexMin), CONFIG.zoomIndexMax);
            screenToCanvasZoomMult = Math.pow(2, zoomIndex);
        }

        if (image !== null) {
            updateFrameBrightness(frameIndex);
        }

        return true;
    }

    function updateFrameBrightness(frameIndex) {
        const frame = frames[frameIndex];

        if (frame.image === null) return;

        frame.offscreenCanvas.width = frame.image.width;
        frame.offscreenCanvas.height = frame.image.height;
        frame.offscreenContext.drawImage(frame.image, 0, 0);
        const imageData = frame.offscreenContext.getImageData(0, 0, frame.offscreenCanvas.width, frame.offscreenCanvas.height);
        if (state.brightness !== 1) {
            for (let i = 0; i < imageData.width * imageData.height; i++) {
                for (let j = 0; j < 3; j++) {
                    imageData.data[i * 4 + j] = Math.min(imageData.data[i * 4 + j] * state.brightness, 255);
                }
            }
        }
        frame.offscreenContext.putImageData(imageData, 0, 0);
    }

    function updateBrightness() {
        for (let i = 0; i < frames.length; i++) {
            updateFrameBrightness(i);
        }
    }

    /**
     * 
     * @param {number} frameIndex 
     * @param {number} wx 
     * @param {number} wy 
     * @param {number} wz 
     * @param {number} px 
     * @param {number} py 
     * @returns {number}
     */
    function createPoint(frameIndex, wx, wy, wz, px, py) {
        state.frames[frameIndex].points.push({
            wx: wx,
            wy: wy,
            wz: wz,
            px: px,
            py: py,
        });

        return state.frames[frameIndex].points.length - 1;
    }

    /**
     * 
     * @param {number} frameIndex 
     * @param {number} pointIndex 
     */
    function removePoint(frameIndex, pointIndex) {
        state.frames[frameIndex].points.splice(pointIndex, 1);
        
        if (state.selectedPoint !== null) {
            if (state.selectedPoint[0] === frameIndex && state.selectedPoint[1] === pointIndex) {
                selectPoint(null);
            } else if (state.selectedPoint[1] > pointIndex) {
                state.selectedPoint[1] -= 1;
            }
        }

        for (let i = state.selectedPointHistory.length - 1; i >= 0; i--) {
            if (state.selectedPointHistory[i][0] !== frameIndex) continue;

            if (state.selectedPointHistory[i][1] === pointIndex) {
                state.selectedPointHistory.splice(i, 1);
            } else if (state.selectedPointHistory[i][1] > pointIndex) {
                state.selectedPointHistory[i][1] -= 1;
            }
        }

        for (const line of state.frames[frameIndex].lines) {
            const i = line.points.indexOf(pointIndex);
            if (i !== -1) {
                line.points.splice(i, 1);
            }
        }

        updateAllLineData();
    }
    
    /**
     * 
     * @param {number | null} frameIndex 
     * @param {number | null} pointIndex 
    */
   function selectPoint(frameIndex, pointIndex) {
        const isNull = frameIndex === null || frameIndex === null;
        if (state.selectedPoint === null ? isNull : state.selectedPoint[0] === frameIndex && state.selectedPoint[1] === pointIndex) return;

        state.selectedPoint = isNull ? null : [frameIndex, pointIndex];
        
        if (!isNull) {
            const i = state.selectedPointHistory.findIndex((point) => point[0] === frameIndex && point[1] === pointIndex);
            if (i !== -1) state.selectedPointHistory.splice(i, 1);
            state.selectedPointHistory.push([frameIndex, pointIndex]);
        }

        // TODO:
        draggedPointIndex = null;
    }

    /**
     * 
     * @param {number} frameIndex 
     * @param {number} pointIndex 
     * @param {number} wx 
     * @param {number} wy 
     * @param {number} wz 
     */
    function movePointWorld(frameIndex, pointIndex, wx, wy, wz) {
        const point = state.frames[frameIndex].points[pointIndex];
        point.wx = wx;
        point.wy = wy;
        point.wz = wz;
    }

    /**
     * 
     * @param {number} frameIndex 
     * @param {number} pointIndex 
     * @param {number} px 
     * @param {number} py 
     */
    function movePointProjected(frameIndex, pointIndex, px, py) {
        const point = state.frames[frameIndex].points[pointIndex];
        point.px = px;
        point.py = py;
    }

    /**
     * 
     * @param {number} frameIndex 
     * @param {number} pointIndex 
     * @param {number} precision 
     */
    function setPointPrecision(frameIndex, pointIndex, precision) {
        const point = state.frames[frameIndex].points[pointIndex];
        if (precision !== undefined) {
            point.precision = precision;
        } else {
            delete point.precision;
        }
    }

    /**
     * 
     * @param {number} frameIndex 
     * @returns {number}
     */
    function createLine(frameIndex) {
        state.frames[frameIndex].lines.push({
            points: [],
            pixels: [],
        });

        linesData[frameIndex].push(null);

        return state.frames[frameIndex].lines.length - 1;
    }

    /**
     * 
     * @param {number} frameIndex 
     * @param {number} lineIndex 
     */
    function removeLine(frameIndex, lineIndex) {
        state.frames[frameIndex].lines.splice(lineIndex, 1);

        if (state.selectedLine !== null && state.selectedLine[0] === frameIndex && state.selectedLine[1] === lineIndex) {
            state.selectedLine = null;
        } else if (state.selectedLine[1] > lineIndex) {
            state.selectedLine[1] -= 1;
        }
        
        linesData[frameIndex].splice(lineIndex, 1);
    }

    /**
     * 
     * @param {number} x1 
     * @param {number} y1 
     * @param {number} x2 
     * @param {number} y2 
     * @returns {{
     *     a: number,
     *     b: number,
     *     c: number,
     * }}
     */
    function calculateLineABC(x1, y1, x2, y2) {
        return {
            a: y2 - y1,
            b: x1 - x2,
            c: x2 * y1 - x1 * y2,
        };
    }

    /**
     * 
     * @param {number} x1 
     * @param {number} y1 
     * @param {number} x2 
     * @param {number} y2 
     * @returns {{
     *     a: number,
     *     b: number,
     *     c: number,
     * }}
     */
    function calculateLineABCNorm(x1, y1, x2, y2) {
        const abc = calculateLineABC(x1, y1, x2, y2);
        const len = Math.sqrt(abc.a * abc.a + abc.b * abc.b);
        abc.a /= len;
        abc.b /= len;
        abc.c /= len;
        return abc;
    }

    /**
     * 
     * @param {number} a1 
     * @param {number} b1 
     * @param {number} c1 
     * @param {number} a2 
     * @param {number} b2 
     * @param {number} c2 
     * @returns {{
     *     x: number,
     *     y: number,
     * }}
     */
    function calculateLineIntersection(a1, b1, c1, a2, b2, c2) {
        const den = b2 * a1 - b1 * a2;

        return {
            x: (b1 * c2 - b2 * c1) / den,
            y: (a2 * c1 - a1 * c2) / den,
        };
    }

    /**
     * 
     * @param {number} frameIndex 
     * @param {number} lineIndex 
     * @returns {LineData | null}
     */
    function calculateLineData(frameIndex, lineIndex) {
        const line = state.frames[frameIndex].lines[lineIndex];

        let emptyCount = 0;
        let filledCount = 0;
        for (const pixel of line.pixels) {
            if (!pixel.filled) {
                emptyCount += 1;
            } else {
                filledCount += 1;
            }
        }

        // there must be at least 1 point of one type and 2 of the other type
        if (emptyCount === 0 || filledCount === 0 || filledCount + emptyCount === 2) {
            return null;
        }

        let emptyToFilledStartPixelIndex = null;
        let emptyToFilledEndPixelIndex = null;
        let filledToEmptyStartPixelIndex = null;
        let filledToEmptyEndPixelIndex = null;

        // Find all lines going throgh 2 pixel that have only empty pixels to the left only filled pixels to the right
        for (let i = 0; i < line.pixels.length; i++) {
            const pixel1 = line.pixels[i];
            for (let j = 0; j < line.pixels.length; j++) {
                const pixel2 = line.pixels[j];
                if (pixel1.filled === pixel2.filled) continue;
                
                const dirX = (pixel2.px + 0.5) - (pixel1.px + 0.5);
                const dirY = (pixel2.py + 0.5) - (pixel1.py + 0.5);
                
                const { a, b, c } = calculateLineABCNorm(pixel1.px + 0.5, pixel1.py + 0.5, pixel2.px + 0.5, pixel2.py + 0.5);

                let good = true;

                let minT = Number.MAX_VALUE;
                let minPixelIndex = i;
                let maxT = -Number.MAX_VALUE;
                let maxPixelIndex = j;

                for (let k = 0; k < line.pixels.length; k++) {
                    const pixel = line.pixels[k];
                    // distance from the line, positive to the left
                    let d = (pixel.px + 0.5) * a + (pixel.py + 0.5) * b + c;

                    // filled pixels need to have negative d
                    if (pixel.filled) d *= -1;

                    if (d < -1e-9) {
                        good = false;
                        break;
                    } else if (d <= 1e-9) {
                        // scaled distance along the line
                        const t = dirX * (pixel.px + 0.5) + dirY * (pixel.py + 0.5);

                        if (pixel.filled === pixel1.filled) {
                            if (t < minT) {
                                minT = t;
                                minPixelIndex = k;
                            }
                        } else {
                            if (t > maxT) {
                                maxT = t;
                                maxPixelIndex = k;
                            }
                        }
                    }
                }

                if (!good) continue;

                if (!pixel1.filled) {
                    emptyToFilledStartPixelIndex = minPixelIndex;
                    emptyToFilledEndPixelIndex = maxPixelIndex;
                } else {
                    filledToEmptyStartPixelIndex = minPixelIndex;
                    filledToEmptyEndPixelIndex = maxPixelIndex;
                }
            }
        }

        // could not find any splitting lines
        if (emptyToFilledStartPixelIndex === null || emptyToFilledEndPixelIndex === null || filledToEmptyStartPixelIndex === null || filledToEmptyEndPixelIndex === null) {
            return null;
        }

        // happens when all of the pixels are on the same line
        if (emptyToFilledStartPixelIndex === filledToEmptyEndPixelIndex && emptyToFilledEndPixelIndex === filledToEmptyStartPixelIndex) {
            return null;
        }

        /**
         * 
         * @param {Line} line 
         * @param {number} startPixelIndex 
         * @param {number} endPixelIndex 
         * @returns {number[] | null}
         */
        function findSplitPath(line, startPixelIndex, endPixelIndex) {
            const path = [];
            
            const visitedPixels = new Set();
            let currentPixelIndex = startPixelIndex;

            path.push(currentPixelIndex);
            visitedPixels.add(currentPixelIndex);

            while (currentPixelIndex !== endPixelIndex) {
                const currentPixel = line.pixels[currentPixelIndex];
                
                let nextPixelIndex = null;

                for (let possibleNextPixelIndex = 0; possibleNextPixelIndex < line.pixels.length; possibleNextPixelIndex++) {
                    if (visitedPixels.has(possibleNextPixelIndex)) continue;

                    const possibleNextPixel = line.pixels[possibleNextPixelIndex];
                    if (possibleNextPixel.filled !== currentPixel.filled) continue;

                    const dirX = (possibleNextPixel.px + 0.5) - (currentPixel.px + 0.5);
                    const dirY = (possibleNextPixel.py + 0.5) - (currentPixel.py + 0.5);
                    
                    const { a, b, c } = calculateLineABCNorm(currentPixel.px + 0.5, currentPixel.py + 0.5, possibleNextPixel.px + 0.5, possibleNextPixel.py + 0.5);
    
                    let good = true;
    
                    let maxT = -Number.MAX_VALUE;
                    let maxPixelIndex = possibleNextPixelIndex;

                    const possibleVisitedPixels = new Set();
    
                    for (let k = 0; k < line.pixels.length; k++) {
                        const pixel = line.pixels[k];
                        // distance from the line, positive to the left
                        let d = (pixel.px + 0.5) * a + (pixel.py + 0.5) * b + c;
    
                        // filled pixels need to have negative d
                        if (pixel.filled) d *= -1;
    
                        if (d < -1e-9) {
                            good = false;
                            break;
                        } else if (d <= 1e-9) {
                            possibleVisitedPixels.add(k);

                            // scaled distance along the line
                            const t = dirX * (pixel.px + 0.5) + dirY * (pixel.py + 0.5);
    
                            if (pixel.filled === possibleNextPixel.filled) {
                                if (t > maxT) {
                                    maxT = t;
                                    maxPixelIndex = k;
                                }
                            }
                        }
                    }
    
                    if (!good) continue;

                    for (const pixelIndex of possibleVisitedPixels) {
                        visitedPixels.add(pixelIndex);
                    }
                    nextPixelIndex = maxPixelIndex;
                    break;
                }

                // could not find a path of splitting lines from start to end, this probably never happens
                if (nextPixelIndex === null) {
                    return null;
                }

                path.push(nextPixelIndex);
                currentPixelIndex = nextPixelIndex;
            }

            return path;
        }

        const emptySplitPath = findSplitPath(line, emptyToFilledStartPixelIndex, filledToEmptyEndPixelIndex);
        if (emptySplitPath === null) return null;
        const filledSplitPath = findSplitPath(line, filledToEmptyStartPixelIndex, emptyToFilledEndPixelIndex);
        if (filledSplitPath === null) return null;
        
        return {
            emptySplitPath: emptySplitPath,
            filledSplitPath: filledSplitPath,
        };
    }

    /**
     * 
     * @param {number} frameIndex 
     * @param {number} lineIndex 
     */
    function updateLineData(frameIndex, lineIndex) {
        linesData[frameIndex][lineIndex] = calculateLineData(frameIndex, lineIndex);
    }

    /**
     * 
     */
    function updateAllLineData() {
        for (let frameIndex = 0; frameIndex < state.frames.length; frameIndex++) {
            linesData[frameIndex].length = 0;
            for (let lineIndex = 0; lineIndex < state.frames[frameIndex].lines.length; lineIndex++) {
                linesData[frameIndex].push(calculateLineData(frameIndex, lineIndex));
            }
        }
    }

    /**
     * 
     * @param {number} frameIndex 
     * @param {number} lineIndex 
     * @returns {{
     *     a: number,
     *     b: number,
     *     c: number,
     * } | null}
     */
    function calculateBestLineABCNorm(frameIndex, lineIndex) {
        const line = state.frames[frameIndex].lines[lineIndex];
        const lineData = linesData[frameIndex][lineIndex];
        if (lineData === null) return null;

        const emptyStartIndex = lineData.emptySplitPath[0];
        const emptyEndIndex = lineData.emptySplitPath[lineData.emptySplitPath.length - 1];
        const filledStartIndex = lineData.filledSplitPath[0];
        const filledEndIndex = lineData.filledSplitPath[lineData.filledSplitPath.length - 1];

        const emptyStartPixel = line.pixels[emptyStartIndex];
        const emptyEndPixel = line.pixels[emptyEndIndex];
        const filledStartPixel = line.pixels[filledStartIndex];
        const filledEndPixel = line.pixels[filledEndIndex];

        // empty start -> filled end
        const { a: a1, b: b1, c: c1 } = calculateLineABCNorm(emptyStartPixel.px + 0.5, emptyStartPixel.py + 0.5, filledEndPixel.px + 0.5, filledEndPixel.py + 0.5);
        // filled start -> empty end
        const { a: a2, b: b2, c: c2 } = calculateLineABCNorm(filledStartPixel.px + 0.5, filledStartPixel.py + 0.5, emptyEndPixel.px + 0.5, emptyEndPixel.py + 0.5);

        return {
            a: (a1 + a2) / 2,
            b: (b1 + b2) / 2,
            c: (c1 + c2) / 2,
        };
    }

    /**
     * 
     * @param {number} frameIndex 
     * @param {number} lineIndex 
     * @param {number} pointIndex 
     */
    function toggleLinePoint(frameIndex, lineIndex, pointIndex) {
        const line = state.frames[frameIndex].lines[lineIndex];

        const i = line.points.indexOf(pointIndex);
        if (i !== -1) {
            line.points.splice(i, 1);

            if (line.points.length === 0 && line.pixels.length === 0) {
                removeLine(frameIndex, lineIndex);
            }
        } else {
            line.points.push(pointIndex);
        }

        updateLineData(frameIndex, lineIndex);
    }

    /**
     * 
     * @param {number} frameIndex 
     * @param {number} lineIndex 
     * @param {number} px 
     * @param {number} py 
     */
    function toggleLinePixel(frameIndex, lineIndex, px, py) {
        const line = state.frames[frameIndex].lines[lineIndex];

        for (let i = 0; i < line.pixels.length; i++) {
            const pixel = line.pixels[i];

            if (pixel.px === px && pixel.py === py) {
                const filled = pixel.filled;
                const newFilled = filled === null ? false : filled === false ? true : null;

                if (newFilled === null) {
                    line.pixels.splice(i, 1);

                    if (line.points.length === 0 && line.pixels.length === 0) {
                        removeLine(frameIndex, lineIndex);
                        return;
                    }
                } else {
                    pixel.filled = newFilled;
                }

                updateLineData(frameIndex, lineIndex);

                return;
            }
        }

        line.pixels.push({
            px: px,
            py: py,
            filled: false,
        });

        updateLineData(frameIndex, lineIndex);
    }

    /**
     * 
     * @param {number} frameIndex 
     * @param {number} lineIndex 
     * @returns {boolean}
     */
    function validateLine(frameIndex, lineIndex) {
        return linesData[frameIndex][lineIndex] !== null;
    }

    /**
     * 
     * @param {number | null} frameIndex 
     * @param {number | null} lineIndex 
     * @returns {boolean}
     */
    function selectLine(frameIndex, lineIndex) {
        // console.log(`selectLine(${frameIndex}, ${lineIndex})`);

        const isNull = frameIndex === null || lineIndex === null;
        if (state.selectedLine === null ? isNull : state.selectedLine[0] === frameIndex && state.selectedLine[1] === lineIndex) return true;

        if (state.selectedLine !== null) {
            if (!validateLine(state.selectedLine[0], state.selectedLine[1])) {
                const line = state.frames[state.selectedLine[0]].lines[state.selectedLine[1]];

                if (line.points.length !== 0 || line.pixels.length !== 0) {
                    if (!window.confirm("The selected line is not valid. Deselecting will delete it.")) {
                        return false;
                    }
                }
    
                removeLine(state.selectedLine[0], state.selectedLine[1]);
            }
        }

        state.selectedLine = isNull ? null : [frameIndex, lineIndex];

        // console.log(`state.selectedLine = ${JSON.stringify(state.selectedLine)}`);

        return true;
    }

    // /**
    //  * 
    //  * @param {Line} line 
    //  * @param {number} pointIndex 
    //  * @returns {{
    //  *     minDist: number,
    //  *     minDirX: number,
    //  *     minDirY: number,
    //  *     maxDist: number,
    //  *     maxDirX: number,
    //  *     maxDirY: number,
    //  * } | null}
    //  */
    // function getLineCuts(line, pointIndex) {
    //     // the coordinate system of the image uses Y+ going down
    //     // most of the distances are signed, when they are positive the point is to the left of the line

    //     if (line.p0 !== pointIndex && line.p1 !== pointIndex) return null;

    //     const p0 = pointIndex;
    //     const p1 = line.p0 === pointIndex ? line.p1 : line.p0;

    //     const point0 = state.points[p0];
    //     const point1 = state.points[p1];

    //     // vector from the second point to the main point
    //     const pointDirX = point0.px - point1.px;
    //     const pointDirY = point0.py - point1.py;

    //     // the above vector rotated by 90deg facing left
    //     const pointDirNormX = pointDirY;
    //     const pointDirNormY = -pointDirX;

    //     let emptyCount = 0;
    //     let emptyDist = 0;
    //     let filledCount = 0;
    //     let filledDist = 0;

    //     for (const pixel of line.pixels) {
    //         // Distance from the pixel to the approximate line set by the user, scaled by the length of pointDir
    //         const dist = pointDirNormX * ((pixel.px + 0.5) - point1.px) + pointDirNormY * ((pixel.py + 0.5) - point1.py);

    //         if (pixel.filled) {
    //             filledCount += 1;
    //             filledDist += dist;
    //         } else {
    //             emptyCount += 1;
    //             emptyDist += dist;
    //         }
    //     }

    //     if (emptyCount === 0 || filledCount === 0) return null;

    //     emptyDist /= emptyCount;
    //     filledDist /= filledCount;
    //     // are "empty" pixels to the left of the pointDir vector or to the right
    //     const emptyToTheLeft = emptyDist > filledDist;

    //     let minDist = Number.MAX_VALUE;
    //     let minDirX = 0;
    //     let minDirY = 0;
    //     let maxDist = -Number.MAX_VALUE;
    //     let maxDirX = 0;
    //     let maxDirY = 0;

    //     for (let i = 0; i < line.pixels.length; i++) {
    //         const pixel1 = line.pixels[i];
    //         const pixel1Left = pixel1.filled ^ emptyToTheLeft;

    //         for (let j = i + 1; j < line.pixels.length; j++) {
    //             const pixel2 = line.pixels[j];
    //             const pixel2Left = pixel2.filled ^ emptyToTheLeft;
    //             if (pixel1Left === pixel2Left) continue;

    //             // vector between 2 pixels
    //             let pixelDirX = (pixel2.px + 0.5) - (pixel1.px + 0.5);
    //             let pixelDirY = (pixel2.py + 0.5) - (pixel1.py + 0.5);

    //             // Flip the vector if it is not facing the main point
    //             const flipped = pixelDirX * pointDirX + pixelDirY * pointDirY < 0;
    //             if (flipped) {
    //                 pixelDirX *= -1;
    //                 pixelDirY *= -1;
    //             }

    //             const pixelDirNormX = pixelDirY;
    //             const pixelDirNormY = -pixelDirX;

    //             // Distance from the main point to the line going throught two pixels
    //             const dist = (pixelDirNormX * (point0.px - (pixel1.px + 0.5)) + pixelDirNormY * (point0.py - (pixel1.py + 0.5))) / Math.sqrt(pixelDirX * pixelDirX + pixelDirY * pixelDirY);

    //             if (pixel2Left ^ flipped) {
    //                 // Cut off everything to the left - sets max dist
    //                 if (dist > maxDist) {
    //                     maxDist = dist;
    //                     maxDirX = pixelDirX;
    //                     maxDirY = pixelDirY;
    //                 }
    //             } else {
    //                 // Cut off everything to the right - sets min dist
    //                 if (dist < minDist) {
    //                     minDist = dist;
    //                     minDirX = pixelDirX;
    //                     minDirY = pixelDirY;
    //                 }
    //             }
    //         }
    //     }

    //     if (minDist === Number.MAX_VALUE || maxDist === -Number.MAX_VALUE) return null;

    //     const minDirLen = Math.sqrt(minDirX * minDirX + minDirY * minDirY);
    //     const maxDirLen = Math.sqrt(maxDirX * maxDirX + maxDirY * maxDirY);

    //     return {
    //         minDist: minDist,
    //         minDirX: minDirX / minDirLen,
    //         minDirY: minDirY / minDirLen,
    //         maxDist: -maxDist,
    //         maxDirX: -maxDirX / maxDirLen,
    //         maxDirY: -maxDirY / maxDirLen,
    //     };
    // }

    // /**
    //  * @typedef {{
    //  *     x: number,
    //  *     y: number,
    //  * }} PolygonPoint
    //  */

    // /**
    //  * @typedef {PolygonPoint[]} Polygon
    //  */

    // /**
    //  * 
    //  * @param {Polygon} polygon 
    //  * @param {number} cutA 
    //  * @param {number} cutB 
    //  * @param {number} cutC 
    //  */
    // function cutPolygon(polygon, cutA, cutB, cutC) {
    //     const intersections = [];

    //     for (let i = 0; i < polygon.length; i++) {
    //         const p1 = polygon[i];
    //         const p2 = polygon[(i + 1) % polygon.length];

    //         const edgeA = p2.y - p1.y;
    //         const edgeB = p1.x - p2.x;
    //         const edgeC = p2.x * p1.y - p1.x * p2.y;

    //         const intersectionX = (cutB * edgeC - edgeB * cutC) / (edgeB * cutA - cutB * edgeA);
    //         const intersectionY = (cutA * edgeC - edgeA * cutC) / (edgeA * cutB - cutA * edgeB);

    //         if (!Number.isFinite(intersectionX) || !Number.isFinite(intersectionY)) continue;

    //         const edgeLenSq = (p2.x - p1.x) * (p2.x - p1.x) + (p2.y - p1.y) * (p2.y - p1.y);
    //         const t = ((p2.x - p1.x) * (intersectionX - p1.x) + (p2.y - p1.y) * (intersectionY - p1.y)) / edgeLenSq;
    //         if (t < -1e-6 || t > 1) continue;

    //         intersections.push({
    //             x: intersectionX,
    //             y: intersectionY,
    //             i: i,
    //         });
    //     }

    //     if (intersections.length !== 2) return;

    //     const cutDirX = -cutB;
    //     const cutDirY = cutA;

    //     intersections.sort((intersection1, intersection2) => {
    //         const dirX = intersection2.x - intersection1.x;
    //         const dirY = intersection2.y - intersection1.y;
            
    //         return cutDirX * dirX + cutDirY * dirY;
    //     });

    //     let deleteCount = intersections[1].i - intersections[0].i;
    //     if (deleteCount < 0) deleteCount += polygon.length;
    //     deleteCount -= polygon.splice(intersections[0].i + 1, deleteCount, { x: intersections[0].x, y: intersections[0].y }, { x: intersections[1].x, y: intersections[1].y }).length;
    //     polygon.splice(0, deleteCount);
    // }

    // /**
    //  * 
    //  * @param {number} pointIndex 
    //  * @returns {Polygon}
    //  */
    // function calculatePointPolygon(pointIndex) {
    //     const point = state.points[pointIndex];

    //     const polygon = [
    //         { x: point.px - 3, y: point.py - 3 },
    //         { x: point.px + 3, y: point.py - 3 },
    //         { x: point.px + 3, y: point.py + 3 },
    //         { x: point.px - 3, y: point.py + 3 },
    //     ];

    //     for (const s) {
    //         const cuts = getLineCuts(line, pointIndex);
    //         if (cuts === null) continue;

    //         const minA = cuts.minDirY;
    //         const minB = -cuts.minDirX;
    //         const minC = -(point.px * minA + point.py * minB - cuts.minDist);

    //         const maxA = cuts.maxDirY;
    //         const maxB = -cuts.maxDirX;
    //         const maxC = -(point.px * maxA + point.py * maxB - cuts.maxDist);

    //         console.log(`${minA} ${minB} ${minC} ${maxA} ${maxB} ${maxC}`);

    //         cutPolygon(polygon, minA, minB, minC);
    //         cutPolygon(polygon, maxA, maxB, maxC);
    //     }

    //     return polygon;
    // }

    /**
     * @type {HTMLInputElement}
     */
    const imagesInput = document.getElementById("input-images");
    imagesInput.addEventListener("change", () => {
        Promise.allSettled(Array.from(imagesInput.files).map(async (file) => {
            const url = URL.createObjectURL(file);

            const image = await loadImage(url).finally(() => URL.revokeObjectURL(url));

            return [ image, file.name ];
        })).then((results) => {
            let failedCount = 0;

            for (const result of results) {
                if (result.status === "fulfilled") {
                    const [ image, name ] = result.value;

                    let chosenFrameIndex = null;

                    for (let frameIndex = 0; frameIndex < state.frames.length; frameIndex++) {
                        if (frames[frameIndex].image === null && state.frames[frameIndex].name === name) {
                            chosenFrameIndex = frameIndex;
                            break;
                        }
                    }

                    if (chosenFrameIndex === null) {
                        addFrame();
                        chosenFrameIndex = frames.length - 1;
                    }
                    
                    setFrameImage(chosenFrameIndex, image, name);
                } else {
                    failedCount += 1;
                }
            }

            requestRedraw();

            if (failedCount !== 0) {
                alert(`Failed loading ${failedCount} images`);
            }
        });
    });

    /**
     * @type {HTMLSelectElement}
     */
    const pointSelect = document.getElementById("select-point");
    pointSelect.addEventListener("change", () => {
        let frameIndex;
        let pointIndex;
        if (pointSelect.selectedIndex === 0) {
            if (state.selectedPoint === null) return;
            frameIndex = null;
        } else {
            [ frameIndex, pointIndex ] = pointSelect[pointSelect.selectedIndex].innerText.split("-").map((s) => Number(s));
            if (state.selectedPoint !== null && state.selectedPoint[0] === frameIndex && state.selectedPoint[1] === pointIndex) return;
        }

        if (selectLine(null)) {
            selectPoint(frameIndex, pointIndex);
        }

        requestRedraw();
    });

    /**
     * 
     * @param {HTMLInputElement[]} inputs 
     * @param {function(number[]): void} changeCallback 
     */
    function initCoordsInputs(inputs, changeCallback) {
        for (let i = 0; i < inputs.length; i++) {
            const input = inputs[i];

            input.step = "any";
    
            input.addEventListener("keydown", (event) => {
                if (event.key === " ") {
                    event.preventDefault();
    
                    if (event.shiftKey) {
                        inputs[(i + inputs.length - 1) % inputs.length].select();
                    } else {
                        inputs[(i + 1) % inputs.length].select();
                    }
                }
            });
    
            input.addEventListener("paste", (event) => {
                event.preventDefault();

                const text = event.clipboardData.getData("text");
                const coords = text.trim().split(" ").map((s) => Number(s));
    
                if (!coords.includes(NaN)) {
                    if (coords.length === 1) {
                        input.value = coords[0];
                    } else if (coords.length === inputs.length) {
                        for (let j = 0; j < inputs.length; j++) {
                            inputs[j].value = coords[j];
                        }
                    }
                }

                onChange();
            });

            
            input.addEventListener("change", (event) => {
                onChange();
            });

            function onChange() {
                const values = [];
                
                for (let j = 0; j < inputs.length; j++) {
                    values.push(Number(inputs[j].value));
                }
                
                changeCallback(values);
            }
        }
    }

    /**
     * @type {HTMLInputElement}
     */
    const worldPosXInput = document.getElementById("input-world-pos-x");
    /**
     * @type {HTMLInputElement}
     */
    const worldPosYInput = document.getElementById("input-world-pos-y");
    /**
     * @type {HTMLInputElement}
     */
    const worldPosZInput = document.getElementById("input-world-pos-z");

    initCoordsInputs([ worldPosXInput, worldPosYInput, worldPosZInput ], (values) => {
        if (state.selectedPoint === null) return;

        movePointWorld(state.selectedPoint[0], state.selectedPoint[1], ...values);

        requestRedraw();
    });

    /**
     * @type {HTMLInputElement}
     */
    const worldPosCopyInput = document.getElementById("input-world-pos-copy");
    worldPosCopyInput.addEventListener("click", (event) => {
        if (state.selectedPoint === null) return;

        const point = state.frames[state.selectedPoint[0]].points[state.selectedPoint[1]];

        navigator.clipboard.writeText(`${point.wx} ${point.wy} ${point.wz}`);
    });

    /**
     * @type {HTMLInputElement}
     */
    const projectedPosXInput = document.getElementById("input-projected-pos-x");
    /**
     * @type {HTMLInputElement}
     */
    const projectedPosYInput = document.getElementById("input-projected-pos-y");

    initCoordsInputs([ projectedPosXInput, projectedPosYInput ], (values) => {
        if (state.selectedPoint === null) return;

        movePointProjected(state.selectedPoint[0], state.selectedPoint[1], ...values);
    });

    /**
     * @type {HTMLInputElement}
     */
    const projectedPosCopyInput = document.getElementById("input-projected-pos-copy");
    projectedPosCopyInput.addEventListener("click", (event) => {
        if (state.selectedPoint === null) return;

        const point = state.frames[state.selectedPoint[0]].points[state.selectedPoint[1]];

        navigator.clipboard.writeText(`${point.px} ${point.py}`);
    });

    /**
     * @type {HTMLInputElement}
     */
    const precisionInput = document.getElementById("input-precision");

    initCoordsInputs([ precisionInput ], (values) => {
        if (state.selectedPoint === null) return;

        setPointPrecision(state.selectedPoint[0], state.selectedPoint[1], values[0]);

        requestRedraw();
    });

    /**
     * @type {HTMLSelectElement}
     */
    const lineSelect = document.getElementById("select-line");
    lineSelect.addEventListener("change", () => {
        let frameIndex;
        let lineIndex;
        if (lineSelect.selectedIndex === 0) {
            if (state.selectedLine === null) return;
            frameIndex = null;
        } else {
            [ frameIndex, lineIndex ] = lineSelect[lineSelect.selectedIndex].innerText.split("-").map((s) => Number(s));
            if (state.selectedLine !== null && state.selectedLine[0] === frameIndex && state.selectedLine[1] === lineIndex) return;
        }

        if (selectLine(frameIndex, lineIndex)) {
            selectPoint(null);
        }

        requestRedraw();
    });

    /**
     * @type {HTMLButtonElement}
     */
    const addFrameButton = document.getElementById("button-add-frame");
    addFrameButton.addEventListener("click", () => {
        addFrame();

        requestRedraw();
    });

    /**
     * 
     * @param {number} sliderValue 
     * @returns {number}
     */
    function brightnessFunction(sliderValue) {
        return sliderValue * sliderValue / 100;
    }

    /**
     * 
     * @param {number} brightness 
     * @returns {number}
     */
    function brightnessFunctionInv(brightness) {
        return Math.sqrt(brightness * 100);
    }

    /**
     * @type {HTMLInputElement}
     */
    const brightnessInput = document.getElementById("input-brightness");
    brightnessInput.min = 10;
    brightnessInput.max = 100;
    brightnessInput.addEventListener("input", () => {
        brightnessValueLabel.innerText = brightnessValueLabel.innerText = `${brightnessFunction(Number(brightnessInput.value))}x`;
    });
    brightnessInput.addEventListener("change", () => {
        state.brightness = brightnessFunction(Number(brightnessInput.value));
        
        updateBrightness();
        requestRedraw();
    });

    /**
     * @type {HTMLLabelElement}
     */
    const brightnessValueLabel = document.getElementById("label-brightness-value");

    /**
     * @type {HTMLInputElement}
     */
    const showGridInput = document.getElementById("input-show-grid");
    showGridInput.addEventListener("change", () => {
        state.showGrid = showGridInput.checked;

        requestRedraw();
    });
    
    /**
     * @type {HTMLInputElement}
     */
    const showBlurInput = document.getElementById("input-show-blur");
    showBlurInput.addEventListener("change", () => {
        state.showBlur = showBlurInput.checked;

        requestRedraw();
    });
    
    /**
     * @type {HTMLInputElement}
     */
    const showProjectedInput = document.getElementById("input-show-projected");
    showProjectedInput.addEventListener("change", () => {
        state.showProjected = showProjectedInput.checked;

        requestRedraw();
    });
    
    /**
     * @type {HTMLInputElement}
     */
    const offsetBy01Input = document.getElementById("input-offset-by-01");
    offsetBy01Input.addEventListener("change", () => {
        state.offsetBy01 = offsetBy01Input.checked;

        requestRedraw();
    });

    /**
     * @type {HTMLInputElement}
     */
    const cameraPosXInput = document.getElementById("input-camera-pos-x");
    /**
     * @type {HTMLInputElement}
     */
    const cameraPosXLockedInput = document.getElementById("input-camera-pos-x-locked");
    /**
     * @type {HTMLInputElement}
     */
    const cameraPosYInput = document.getElementById("input-camera-pos-y");
    /**
     * @type {HTMLInputElement}
     */
    const cameraPosYLockedInput = document.getElementById("input-camera-pos-y-locked");
    /**
     * @type {HTMLInputElement}
     */
    const cameraPosZInput = document.getElementById("input-camera-pos-z");
    /**
     * @type {HTMLInputElement}
     */
    const cameraPosZLockedInput = document.getElementById("input-camera-pos-z-locked");

    initCoordsInputs([ cameraPosXInput, cameraPosYInput, cameraPosZInput ], (values) => {
        [ state.cameraX, state.cameraY, state.cameraZ ] = values;

        requestRedraw();
    });

    cameraPosXLockedInput.addEventListener("change", (event) => {
        state.cameraXLocked = cameraPosXLockedInput.checked;

        requestRedraw();
    });
    cameraPosYLockedInput.addEventListener("change", (event) => {
        state.cameraYLocked = cameraPosYLockedInput.checked;

        requestRedraw();
    });
    cameraPosZLockedInput.addEventListener("change", (event) => {
        state.cameraZLocked = cameraPosZLockedInput.checked;

        requestRedraw();
    });

    /**
     * @type {HTMLInputElement}
     */
    const cameraPosCopyInput = document.getElementById("input-camera-pos-copy");
    cameraPosCopyInput.addEventListener("click", (event) => {
        navigator.clipboard.writeText(`${state.cameraX} ${state.cameraY} ${state.cameraZ}`);
    });

    /**
     * @type {HTMLInputElement}
     */
    const cameraSpeedXInput = document.getElementById("input-camera-speed-x");
    /**
     * @type {HTMLInputElement}
     */
    const cameraSpeedXLockedInput = document.getElementById("input-camera-speed-x-locked");
    /**
     * @type {HTMLInputElement}
     */
    const cameraSpeedYInput = document.getElementById("input-camera-speed-y");
    /**
     * @type {HTMLInputElement}
     */
    const cameraSpeedYLockedInput = document.getElementById("input-camera-speed-y-locked");
    /**
     * @type {HTMLInputElement}
     */
    const cameraSpeedZInput = document.getElementById("input-camera-speed-z");
    /**
     * @type {HTMLInputElement}
     */
    const cameraSpeedZLockedInput = document.getElementById("input-camera-speed-z-locked");

    initCoordsInputs([ cameraSpeedXInput, cameraSpeedYInput, cameraSpeedZInput ], (values) => {
        [ state.cameraSpeedX, state.cameraSpeedY, state.cameraSpeedZ ] = values;

        requestRedraw();
    });

    cameraSpeedXLockedInput.addEventListener("change", (event) => {
        state.cameraSpeedXLocked = cameraSpeedXLockedInput.checked;

        requestRedraw();
    });
    cameraSpeedYLockedInput.addEventListener("change", (event) => {
        state.cameraSpeedYLocked = cameraSpeedYLockedInput.checked;

        requestRedraw();
    });
    cameraSpeedZLockedInput.addEventListener("change", (event) => {
        state.cameraSpeedZLocked = cameraSpeedZLockedInput.checked;

        requestRedraw();
    });

    /**
     * @type {HTMLInputElement}
     */
    const cameraSpeedCopyInput = document.getElementById("input-camera-speed-copy");
    cameraSpeedCopyInput.addEventListener("click", (event) => {
        navigator.clipboard.writeText(`${state.cameraSpeedX} ${state.cameraSpeedY} ${state.cameraSpeedZ}`);
    });

    /**
     * @type {HTMLInputElement}
     */
    const cameraSpeedWInput = document.getElementById("input-camera-speed-w");
    /**
     * @type {HTMLInputElement}
     */
    const cameraSpeedWLockedInput = document.getElementById("input-camera-speed-w-locked");
    /**
     * @type {HTMLInputElement}
     */
    const cameraSpeedFInput = document.getElementById("input-camera-speed-f");
    /**
     * @type {HTMLInputElement}
     */
    const cameraSpeedFLockedInput = document.getElementById("input-camera-speed-f-locked");
    /**
     * @type {HTMLInputElement}
     */
    const cameraSpeedRInput = document.getElementById("input-camera-speed-r");
    /**
     * @type {HTMLInputElement}
     */
    const cameraSpeedRLockedInput = document.getElementById("input-camera-speed-r-locked");

    initCoordsInputs([ cameraSpeedWInput ], (values) => {
        [ state.cameraSpeedW ] = values;

        requestRedraw();
    });

    initCoordsInputs([ cameraSpeedFInput ], (values) => {
        [ state.cameraSpeedF ] = values;

        requestRedraw();
    });

    initCoordsInputs([ cameraSpeedRInput ], (values) => {
        [ state.cameraSpeedR ] = values;

        requestRedraw();
    });

    cameraSpeedWLockedInput.addEventListener("change", (event) => {
        state.cameraSpeedWLocked = cameraSpeedWLockedInput.checked;

        requestRedraw();
    });
    cameraSpeedFLockedInput.addEventListener("change", (event) => {
        state.cameraSpeedFLocked = cameraSpeedFLockedInput.checked;

        requestRedraw();
    });
    cameraSpeedRLockedInput.addEventListener("change", (event) => {
        state.cameraSpeedRLocked = cameraSpeedRLockedInput.checked;

        requestRedraw();
    });

    /**
     * @type {HTMLInputElement}
     */
    const cameraRotYawInput = document.getElementById("input-camera-rot-yaw");
    /**
     * @type {HTMLInputElement}
     */
    const cameraRotYawLockedInput = document.getElementById("input-camera-rot-yaw-locked");
    /**
     * @type {HTMLInputElement}
     */
    const cameraRotPitchInput = document.getElementById("input-camera-rot-pitch");
    /**
     * @type {HTMLInputElement}
     */
    const cameraRotPitchLockedInput = document.getElementById("input-camera-rot-pitch-locked");

    initCoordsInputs([ cameraRotYawInput, cameraRotPitchInput ], (values) => {
        [ state.cameraYaw, state.cameraPitch ] = values;

        requestRedraw();
    });

    cameraRotYawLockedInput.addEventListener("change", (event) => {
        state.cameraYawLocked = cameraRotYawLockedInput.checked;

        requestRedraw();
    });
    cameraRotPitchLockedInput.addEventListener("change", (event) => {
        state.cameraPitchLocked = cameraRotPitchLockedInput.checked;

        requestRedraw();
    });

    /**
     * @type {HTMLInputElement}
     */
    const cameraRotSpeedYawInput = document.getElementById("input-camera-rot-speed-yaw");
    /**
     * @type {HTMLInputElement}
     */
    const cameraRotSpeedPitchInput = document.getElementById("input-camera-rot-speed-pitch");

    initCoordsInputs([ cameraRotSpeedYawInput, cameraRotSpeedPitchInput ], (values) => {
        [ state.cameraYawSpeed, state.cameraPitchSpeed ] = values;

        requestRedraw();
    });

    /**
     * @type {HTMLInputElement}
     */
    const cameraRotCopyInput = document.getElementById("input-camera-rot-copy");
    cameraRotCopyInput.addEventListener("click", (event) => {
        navigator.clipboard.writeText(`${state.cameraYaw} ${state.cameraPitch}`);
    });

    /**
     * @type {HTMLInputElement}
     */
    const cameraFovInput = document.getElementById("input-camera-fov");
    /**
     * @type {HTMLInputElement}
     */
    const cameraFovLockedInput = document.getElementById("input-camera-fov-locked");

    initCoordsInputs([ cameraFovInput ], (values) => {
        [ state.cameraFov ] = values;

        requestRedraw();
    });
    
    cameraFovLockedInput.addEventListener("change", (event) => {
        state.cameraFovLocked = cameraFovLockedInput.checked;

        requestRedraw();
    });

    /**
     * @typedef {{
     *     imageScaleLocked: boolean,
     *     padLeftLocked: boolean,
     *     padRightLocked: boolean,
     *     padTopBottomLocked: boolean,
     *     frameCenterDxLocked: boolean,
     *     frameCenterDyLocked: boolean,
     *     screenWidthLocked: boolean,
     *     screenHeightLocked: boolean,
     * }} SizeLocks
     */

    /**
     * 
     * @param {SizeLocks} locks
     * @returns {boolean}
     */
    function validateLocks(locks) {
        // screenWidth = state.padLeft + imageWidth * state.imageScale + state.padRight
        // screenMainFrameCenterDx = (state.padLeft - state.padRight) / 2

        if (locks.padLeftLocked && locks.padRightLocked && locks.frameCenterDxLocked) return false;
        if (locks.imageScaleLocked && (locks.padLeftLocked + locks.padRightLocked + locks.frameCenterDxLocked >= 2) && locks.screenWidthLocked) return false;
        
        // screenHeight = state.padTop + imageHeight * state.imageScale + state.padBottom
        // screenMainFrameCenterDy = (state.padTop - state.padBottom) / 2
        
        if (locks.padTopBottomLocked && locks.frameCenterDyLocked) return false;
        if (locks.imageScaleLocked && locks.padTopBottomLocked && locks.screenHeightLocked) return false;

        if (locks.screenWidthLocked && (locks.padLeftLocked + locks.padRightLocked + locks.frameCenterDxLocked >= 2) && locks.screenHeightLocked && locks.padTopBottomLocked) return false;

        return true;
    }

    /**
     * 
     * @param {Partial<SizeLocks>} changes 
     */
    function changeLocks(changes) {
        const locks = [
            "imageScaleLocked",
            "screenWidthLocked",
            "screenHeightLocked",
            "frameCenterDxLocked",
            "frameCenterDyLocked",
            "padLeftLocked",
            "padRightLocked",
            "padTopBottomLocked",
        ];
        
        /**
         * @type {string[]}
         */
        const newStateLocks = [];

        for (const key of locks) {
            if (key in changes && changes[key]) {
                newStateLocks.push(key);
            }
        }

        for (const key of locks) {
            if (!(key in changes) && state[key]) {
                newStateLocks.push(key);
            }
            state[key] = false;
        }

        for (const key of newStateLocks) {
            state[key] = true;
            if (!validateLocks(state)) {
                state[key] = false;
            }
        }
    }
    
    /**
     * @type {HTMLInputElement}
     */
    const imageScaleInput = document.getElementById("input-image-scale");
    /**
     * @type {HTMLInputElement}
     */
    const imageScaleLockedInput = document.getElementById("input-image-scale-locked");

    initCoordsInputs([ imageScaleInput ], (values) => {
        [ state.imageScale ] = values;

        requestRedraw();
    });
    
    imageScaleLockedInput.addEventListener("change", (event) => {
        changeLocks({ imageScaleLocked: imageScaleLockedInput.checked });

        requestRedraw();
    });

    /**
     * @type {HTMLInputElement}
     */
    const padLeftInput = document.getElementById("input-pad-left");
    /**
     * @type {HTMLInputElement}
     */
    const padLeftLockedInput = document.getElementById("input-pad-left-locked");

    initCoordsInputs([ padLeftInput ], (values) => {
        if (imageWidth !== null) {
            const [ newPadLeft ] = values;

            const padLeft = (state.screenWidth - imageWidth * state.imageScale) / 2 + state.frameCenterDx;
            const padLeftDelta = newPadLeft - padLeft;

            if (!state.screenWidthLocked || state.imageScaleLocked) {
                state.screenWidth += padLeftDelta;
                state.frameCenterDx += padLeftDelta / 2;
            } else {
                state.imageScale -= padLeftDelta / imageWidth * 2;
            }
        }

        requestRedraw();
    });
    
    padLeftLockedInput.addEventListener("change", (event) => {
        changeLocks({ padLeftLocked: padLeftLockedInput.checked });

        requestRedraw();
    });

    /**
     * @type {HTMLInputElement}
     */
    const padRightInput = document.getElementById("input-pad-right");
    /**
     * @type {HTMLInputElement}
     */
    const padRightLockedInput = document.getElementById("input-pad-right-locked");

    initCoordsInputs([ padRightInput ], (values) => {
        if (imageWidth !== null) {
            const [ newPadRight ] = values;

            const padRight = (state.screenWidth - imageWidth * state.imageScale) / 2 - state.frameCenterDx;
            const padRightDelta = newPadRight - padRight;

            if (!state.screenWidthLocked || state.imageScaleLocked) {
                state.screenWidth += padRightDelta;
                state.frameCenterDx -= padRightDelta / 2;
            } else {
                state.imageScale -= padRightDelta / imageWidth * 2;
            }
        }

        requestRedraw();
    });
    
    padRightLockedInput.addEventListener("change", (event) => {
        changeLocks({ padRightLocked: padRightLockedInput.checked });

        requestRedraw();
    });

    /**
     * @type {HTMLInputElement}
     */
    const padTopInput = document.getElementById("input-pad-top");

    initCoordsInputs([ padTopInput ], (values) => {
        if (imageWidth !== null) {
            const [ newPadTop ] = values;

            const padTop = (state.screenHeight - imageHeight * state.imageScale) / 2 + state.frameCenterDy;
            const padTopDelta = newPadTop - padTop;
            
            if (!state.screenHeightLocked || state.imageScaleLocked) {
                state.screenHeight += padTopDelta;
                state.frameCenterDy += padTopDelta / 2;
            } else {
                state.imageScale -= padTopDelta / imageHeight * 2;
            }
        }

        requestRedraw();
    });

    /**
     * @type {HTMLInputElement}
     */
    const padBottomInput = document.getElementById("input-pad-bottom");
    
    initCoordsInputs([ padBottomInput ], (values) => {
        if (imageWidth !== null) {
            const [ newPadBottom ] = values;

            const padBottom = (state.screenHeight - imageHeight * state.imageScale) / 2 - state.frameCenterDy;
            const padBottomDelta = newPadBottom - padBottom;

            if (!state.screenHeightLocked || state.imageScaleLocked) {
                state.screenHeight += padBottomDelta;
                state.frameCenterDy -= padBottomDelta / 2;
            } else {
                state.imageScale -= padBottomDelta / imageHeight * 2;
            }
        }
        
        requestRedraw();
    });
    
    /**
     * @type {HTMLInputElement}
     */
    const padTopBottomLockedInput = document.getElementById("input-pad-top-bottom-locked");

    padTopBottomLockedInput.addEventListener("change", (event) => {
        changeLocks({ padTopBottomLocked: padTopBottomLockedInput.checked });

        requestRedraw();
    });

    /**
     * @type {HTMLInputElement}
     */
    const frameCenterDxInput = document.getElementById("input-frame-center-dx");
    /**
     * @type {HTMLInputElement}
     */
    const frameCenterDxLockedInput = document.getElementById("input-frame-center-dx-locked");

    initCoordsInputs([ frameCenterDxInput ], (values) => {
        [ state.frameCenterDx ] = values;

        requestRedraw();
    });
    
    frameCenterDxLockedInput.addEventListener("change", (event) => {
        changeLocks({ frameCenterDxLocked: frameCenterDxLockedInput.checked });

        requestRedraw();
    });

    /**
     * @type {HTMLInputElement}
     */
    const frameCenterDyInput = document.getElementById("input-frame-center-dy");
    /**
     * @type {HTMLInputElement}
     */
    const frameCenterDyLockedInput = document.getElementById("input-frame-center-dy-locked");

    initCoordsInputs([ frameCenterDyInput ], (values) => {
        [ state.frameCenterDy ] = values;

        requestRedraw();
    });
    
    frameCenterDyLockedInput.addEventListener("change", (event) => {
        changeLocks({ frameCenterDyLocked: frameCenterDyLockedInput.checked });

        requestRedraw();
    });

    /**
     * @type {HTMLInputElement}
     */
    const screenWidthInput = document.getElementById("input-screen-width");
    /**
     * @type {HTMLInputElement}
     */
    const screenWidthLockedInput = document.getElementById("input-screen-width-locked");

    initCoordsInputs([ screenWidthInput ], (values) => {
        [ state.screenWidth ] = values;

        requestRedraw();
    });
    
    screenWidthLockedInput.addEventListener("change", (event) => {
        changeLocks({ screenWidthLocked: screenWidthLockedInput.checked });

        requestRedraw();
    });

    /**
     * @type {HTMLInputElement}
     */
    const screenHeightInput = document.getElementById("input-screen-height");
    /**
     * @type {HTMLInputElement}
     */
    const screenHeightLockedInput = document.getElementById("input-screen-height-locked");

    initCoordsInputs([ screenHeightInput ], (values) => {
        [ state.screenHeight ] = values;

        requestRedraw();
    });
    
    screenHeightLockedInput.addEventListener("change", (event) => {
        changeLocks({ screenHeightLocked: screenHeightLockedInput.checked });

        requestRedraw();
    });

    /**
     * @type {HTMLInputElement}
     */
    const zoomCenterSpeedXInput = document.getElementById("input-zoom-center-speed-x");
    /**
     * @type {HTMLInputElement}
     */
    const zoomCenterSpeedXLockedInput = document.getElementById("input-zoom-center-speed-x-locked");
    /**
     * @type {HTMLInputElement}
     */
    const zoomCenterSpeedYInput = document.getElementById("input-zoom-center-speed-y");
    /**
     * @type {HTMLInputElement}
     */
    const zoomCenterSpeedYLockedInput = document.getElementById("input-zoom-center-speed-y-locked");

    initCoordsInputs([ zoomCenterSpeedXInput, zoomCenterSpeedYInput ], (values) => {
        [ state.zoomCenterSpeedX, state.zoomCenterSpeedY ] = values;

        requestRedraw();
    });

    zoomCenterSpeedXLockedInput.addEventListener("change", (event) => {
        state.zoomCenterSpeedXLocked = zoomCenterSpeedXLockedInput.checked;

        requestRedraw();
    });
    zoomCenterSpeedYLockedInput.addEventListener("change", (event) => {
        state.zoomCenterSpeedYLocked = zoomCenterSpeedYLockedInput.checked;

        requestRedraw();
    });

    /**
     * @type {HTMLInputElement}
     */
    const zoomSpeedInput = document.getElementById("input-zoom-speed");
    /**
     * @type {HTMLInputElement}
     */
    const zoomSpeedLockedInput = document.getElementById("input-zoom-speed-locked");

    initCoordsInputs([ zoomSpeedInput ], (values) => {
        [ state.zoomSpeed ] = values;

        requestRedraw();
    });

    zoomSpeedLockedInput.addEventListener("change", (event) => {
        state.zoomSpeedLocked = zoomSpeedLockedInput.checked;

        requestRedraw();
    });

    /**
     * @type {HTMLInputElement}
     */
    const cameraTpCopyInput = document.getElementById("input-camera-tp-copy");
    cameraTpCopyInput.addEventListener("click", (event) => {
        navigator.clipboard.writeText(`/tp @s ${state.cameraX} ${state.cameraY - 1.62} ${state.cameraZ} ${state.cameraYaw} ${state.cameraPitch}`);
    });

    /**
     * @type {HTMLInputElement}
     */
    const cameraTpCopyOffsetInput = document.getElementById("input-camera-tp-copy-offset");
    cameraTpCopyOffsetInput.addEventListener("click", (event) => {
        const sinYaw = Math.sin(state.cameraYaw * (Math.PI / 180));
        const cosYaw = Math.cos(state.cameraYaw * (Math.PI / 180));
        const sinPitch = Math.sin(state.cameraPitch * (Math.PI / 180));
        const cosPitch = Math.cos(state.cameraPitch * (Math.PI / 180));

        const lookDirX = cosPitch * -sinYaw;
        const lookDirY = -sinPitch;
        const lookDirZ = cosPitch * cosYaw;

        const offset = state.offsetBy01 ? -0.1 : 0.1;

        navigator.clipboard.writeText(`/tp @s ${state.cameraX + lookDirX * offset} ${state.cameraY + lookDirY * offset - 1.62} ${state.cameraZ + lookDirZ * offset} ${state.cameraYaw} ${state.cameraPitch}`);
    });

    /**
     * @type {HTMLSelectElement}
     */
    const reversalMethodSelect = document.getElementById("select-reversal-method");
    reversalMethodSelect.addEventListener("change", () => {
        state.reversalMethod = reversalMethodSelect.value;

        requestRedraw();
    });

    /**
     * @type {HTMLInputElement}
     */
    const iterationsInput = document.getElementById("input-iterations");
    iterationsInput.min = 1;
    iterationsInput.addEventListener("change", (event) => {
        state.iterations = Math.max(Math.floor(Number(iterationsInput.value)), 1);

        requestRedraw();
    });

    /**
     * @type {HTMLInputElement}
     */
    const reverseInput = document.getElementById("input-reverse");
    reverseInput.addEventListener("click", (event) => {
        if (imageWidth === null) return;

        const constants = projectConstants();
        const variablesInitial = projectVariables();
        const variablesLocked = projectVariablesLocked();
        const frames = projectFrames();
        const descentFunc = ({
            "gradient": gradientDescent,
            "perparam": perParamDescent,
            "random": randomDescent,
        })[state.reversalMethod];
        const [ cameraX, cameraY, cameraZ, cameraSpeedX, cameraSpeedY, cameraSpeedZ, cameraSpeedW, cameraSpeedF, cameraSpeedR, cameraYaw, cameraPitch, cameraFov, imageScale, screenHeight, screenMainFrameCenterDx, screenMainFrameCenterDy, screenFrameCenterSpeedX, screenFrameCenterSpeedY, screenZoomSpeed, ...times ] = reverseProjection(constants, variablesInitial, variablesLocked, frames, descentFunc, state.iterations);
        if (!state.cameraXLocked) state.cameraX = cameraX;
        if (!state.cameraYLocked) state.cameraY = cameraY;
        if (!state.cameraZLocked) state.cameraZ = cameraZ;
        if (!state.cameraSpeedXLocked) state.cameraSpeedX = cameraSpeedX;
        if (!state.cameraSpeedYLocked) state.cameraSpeedY = cameraSpeedY;
        if (!state.cameraSpeedZLocked) state.cameraSpeedZ = cameraSpeedZ;
        if (!state.cameraSpeedWLocked) state.cameraSpeedW = cameraSpeedW;
        if (!state.cameraSpeedFLocked) state.cameraSpeedF = cameraSpeedF;
        if (!state.cameraSpeedRLocked) state.cameraSpeedR = cameraSpeedR;
        if (!state.cameraYawLocked) state.cameraYaw = cameraYaw / (Math.PI / 180);
        if (!state.cameraPitchLocked) state.cameraPitch = cameraPitch / (Math.PI / 180);
        if (!state.cameraFovLocked) state.cameraFov = cameraFov / (Math.PI / 180);

        if (!state.imageScaleLocked) state.imageScale = imageScale;

        // screenWidth = state.padLeft + imageWidth * state.imageScale + state.padRight
        // screenMainFrameCenterDx = (state.padLeft - state.padRight) / 2
        const padLeft = (state.screenWidth - imageWidth * state.imageScale) / 2 + state.frameCenterDx;
        const padRight = (state.screenWidth - imageWidth * state.imageScale) / 2 - state.frameCenterDx;
        const padH = state.padLeftLocked ? 2 * (padLeft - screenMainFrameCenterDx) : state.padRightLocked ? 2 * (padRight + screenMainFrameCenterDx) : Math.abs(screenMainFrameCenterDx * 2);
        if (!state.screenWidthLocked) state.screenWidth = padH + imageWidth * imageScale;
        if (!state.frameCenterDxLocked) state.frameCenterDx = screenMainFrameCenterDx;
        
        // screenHeight = state.padTop + imageHeight * state.imageScale + state.padBottom
        // screenMainFrameCenterDy = (state.padTop - state.padBottom) / 2
        if (!state.screenHeightLocked) state.screenHeight = screenHeight;
        if (!state.frameCenterDyLocked) state.frameCenterDy = screenMainFrameCenterDy;

        if (!state.zoomCenterSpeedXLocked) state.zoomCenterSpeedX = screenFrameCenterSpeedX;
        if (!state.zoomCenterSpeedYLocked) state.zoomCenterSpeedY = screenFrameCenterSpeedY;
        if (!state.zoomSpeedLocked) state.zoomSpeed = screenZoomSpeed;
        const mainFrameTime = state.frames[state.mainFrameIndex].time;
        for (let frameIndex = 0; frameIndex < state.frames.length; frameIndex++) {
            if (!state.frames[frameIndex].timeLocked) state.frames[frameIndex].time = times[frameIndex] + mainFrameTime;
        }

        requestRedraw();
    });

    const errorLabel = document.getElementById("label-error");

    /**
     * @type {HTMLInputElement}
     */
    const moveWorldXInput = document.getElementById("input-move-world-x");
    /**
     * @type {HTMLInputElement}
     */
    const moveWorldYInput = document.getElementById("input-move-world-y");
    /**
     * @type {HTMLInputElement}
     */
    const moveWorldZInput = document.getElementById("input-move-world-z");

    initCoordsInputs([ moveWorldXInput, moveWorldYInput, moveWorldZInput ], (values) => {
        [ state.moveWorldX, state.moveWorldY, state.moveWorldZ ] = values;
        
        requestRedraw();
    });

    /**
     * @type {HTMLInputElement}
     */
    const moveWorldInput = document.getElementById("input-move-world");
    moveWorldInput.addEventListener("click", (event) => {
        const dx = state.moveWorldX;
        const dy = state.moveWorldY;
        const dz = state.moveWorldZ;

        for (const frame of state.frames) {
            for (const point of frame.points) {
                point.wx += dx;
                point.wy += dy;
                point.wz += dz;
            }
        }
        state.cameraX += dx;
        state.cameraY += dy;
        state.cameraZ += dz;

        state.moveWorldX = 0;
        state.moveWorldY = 0;
        state.moveWorldZ = 0;
        
        requestRedraw();
    });

    /**
     * @type {HTMLInputElement}
     */
    const moveRotateInput = document.getElementById("input-rotate-world");
    moveRotateInput.addEventListener("click", (event) => {
        const cx = state.moveWorldX + 0.5;
        const cz = state.moveWorldZ + 0.5;

        function rotatePos(x, z) {
            const dx = x - cx;
            const dz = z - cz;

            const newDx = -dz;
            const newDz = dx;

            return [ cx + newDx, cz + newDz ];
        }

        for (const frame of state.frames) {
            for (const point of frame.points) {
                [ point.wx, point.wz ] = rotatePos(point.wx, point.wz);
            }
        }
        [ state.cameraX, state.cameraZ ] = rotatePos(state.cameraX, state.cameraZ);
        state.cameraYaw += 90;
        if (state.cameraYaw > 180) state.cameraYaw -= 360;
        
        requestRedraw();
    });

    /**
     * @type {HTMLTextAreaElement}
     */
    const stateTextarea = document.getElementById("textarea-state");
    stateTextarea.readOnly = true;
    stateTextarea.addEventListener("paste", (event) => {
        const newState = JSON.parse(event.clipboardData.getData("text"));

        while (frames.length < newState.frames.length) {
            addFrame();
        }
        while (frames.length > newState.frames.length) {
            removeFrame(frames.length - 1);
        }

        for (let frameIndex = 0; frameIndex < state.frames.length; frameIndex++) {
            if (frames[frameIndex].image !== null) {
                newState.frames[frameIndex].name = state.frames[frameIndex].name;
            }
        }

        for (const key in state) {
            if (typeof newState[key] === "undefined") {
                newState[key] = JSON.parse(JSON.stringify(state[key]));
            }
        }
        for (const key in newState) {
            if (!(key in defaultState)) {
                delete newState[key];
            }
        }

        state = newState;

        updateAllLineData();

        requestRedraw();
    });

    /**
     * @type {HTMLTextAreaElement}
     */
    const tomdataTextarea = document.getElementById("textarea-tomdata");
    tomdataTextarea.readOnly = true;
    tomdataTextarea.addEventListener("paste", (event) => {
        if (state.selectedPoint === null) return;

        const points = JSON.parse(event.clipboardData.getData("text").replaceAll("(", "[").replaceAll(")", "]"));

        const frameIndex = state.selectedPoint[0];

        for (let pointIndex = state.frames[frameIndex].points.length - 1; pointIndex >= 0; pointIndex--) {
            removePoint(frameIndex, pointIndex);
        }

        for (const point of points) {
            createPoint(frameIndex, ...point[0], ...point[1]);
        }

        requestRedraw();
    });

    // let axis1 = [ 0, 1 ];
    // let axis2 = [ 2, 1 ];

    // function registerAxis(axis, axisIndexSelect, axisRangeInput) {
    //     axisIndexSelect.addEventListener("change", (event) => {
    //         axis[0] = axisIndexSelect.selectedIndex;

    //         requestRedraw();
    //     });

    //     axisRangeInput.addEventListener("change", (event) => {
    //         axis[1] = Number(axisRangeInput.value);

    //         requestRedraw();
    //     });
    // }

    // /**
    //  * @type {HTMLSelectElement}
    //  */
    // const axis1IndexSelect = document.getElementById("select-axis-1-index");

    // /**
    //  * @type {HTMLInputElement}
    //  */
    // const axis1RangeInput = document.getElementById("input-axis-1-range");

    // registerAxis(axis1, axis1IndexSelect, axis1RangeInput);

    // /**
    //  * @type {HTMLSelectElement}
    //  */
    // const axis2IndexSelect = document.getElementById("select-axis-2-index");

    // /**
    //  * @type {HTMLInputElement}
    //  */
    // const axis2RangeInput = document.getElementById("input-axis-2-range");

    // registerAxis(axis2, axis2IndexSelect, axis2RangeInput);

    // let maxError = 100;

    // const maxErrorInput = document.getElementById("input-max-error");
    // maxErrorInput.addEventListener("change", (event) => {
    //     maxError = maxErrorInput.value;

    //     requestRedraw();
    // });

    // /**
    //  * @type {HTMLCanvasElement}
    //  */
    // const errorCanvas = document.getElementById("canvas-error");
    // const errorContext = errorCanvas.getContext("2d");

    // errorCanvas.addEventListener("click", (event) => {
    //     const inputsAddFuncs = [
    //         (a) => cameraX += a,
    //         (a) => cameraY += a,
    //         (a) => cameraZ += a,
    //         (a) => cameraYaw += a,
    //         (a) => cameraPitch += a,
    //         (a) => cameraFov += a,
    //     ];

    //     const w = errorCanvas.width / 4;
    //     const h = errorCanvas.height / 4;

    //     const x = Math.min(Math.max(Math.floor(event.offsetX / errorCanvas.clientWidth * w), 0), w - 1);
    //     const y = Math.min(Math.max(Math.floor(event.offsetY / errorCanvas.clientHeight * h), 0), h - 1);

    //     const d1 = (x / (w - 1) - 0.5) * axis1[1];
    //     const d2 = (y / (h - 1) - 0.5) * axis2[1];

    //     inputsAddFuncs[axis1[0]](d1);
    //     inputsAddFuncs[axis2[0]](d2);

    //     requestRedraw();
    // });

    window.addEventListener("keydown", (event) => {
        if (state.selectedPoint !== null) {
            if (event.key === "w") {
                event.preventDefault();
    
                worldPosXInput.select();
            }
    
            if (event.key === "p") {
                event.preventDefault();
    
                projectedPosXInput.select();
            }
        }

        if (event.key === "g") {
            event.preventDefault();

            state.showGrid = !state.showGrid;

            requestRedraw();
        }

        if (event.key === "b") {
            event.preventDefault();

            state.showBlur = !state.showBlur;
            
            requestRedraw();
        }
    });

    function roundTo(px, scale) {
        return Math.round(px * scale) / scale;
    }

    // function roundPx(px) {
    //     return Math.round(px * screenToCanvasZoomMult) / screenToCanvasZoomMult;
    // }

    // function floorPx(px) {
    //     return Math.floor(px * screenToCanvasZoomMult) / screenToCanvasZoomMult;
    // }

    // function ceilPx(px) {
    //     return Math.ceil(px * screenToCanvasZoomMult) / screenToCanvasZoomMult;
    // }

    function requestRedraw() {
        window.requestAnimationFrame(redraw);

        /**
         * 
         * @param {HTMLSelectElement} select 
         * @param {[number, number] | null} selected 
         */
        function fillSelectOptions(select, key, selected) {
            select.selectedIndex = 0;

            let optionIndex = 1;
            for (let frameIndex = 0; frameIndex < state.frames.length; frameIndex++) {
                for (let objIndex = 0; objIndex < state.frames[frameIndex][key].length; objIndex++) {
                    const text = `${frameIndex}-${objIndex}`;
                    if (optionIndex < select.length) {
                        select[optionIndex].innerText = text;
                    } else {
                        const option = document.createElement("option");
                        option.innerText = text;
                        select.add(option);
                    }

                    if (selected !== null && selected[0] === frameIndex && selected[1] === objIndex) {
                        select.selectedIndex = optionIndex;
                    }

                    optionIndex += 1;
                }
            }

            while (select.length > optionIndex) {
                select.remove(select.length - 1);
            }
        }

        const multiframe = state.frames.length > 1;
        for (const element of document.querySelectorAll(".multiframe-only")) {
            element.classList.toggle("multiframe-hidden", !multiframe);
        }

        fillSelectOptions(pointSelect, "points", state.selectedPoint);

        const pointSelected = state.selectedPoint !== null;
        worldPosXInput.disabled = !pointSelected;
        worldPosXInput.value = pointSelected ? state.frames[state.selectedPoint[0]].points[state.selectedPoint[1]].wx : "";
        worldPosYInput.disabled = !pointSelected;
        worldPosYInput.value = pointSelected ? state.frames[state.selectedPoint[0]].points[state.selectedPoint[1]].wy : "";
        worldPosZInput.disabled = !pointSelected;
        worldPosZInput.value = pointSelected ? state.frames[state.selectedPoint[0]].points[state.selectedPoint[1]].wz : "";

        worldPosCopyInput.disabled = !pointSelected;

        projectedPosXInput.disabled = !pointSelected;
        projectedPosXInput.value = pointSelected ? state.frames[state.selectedPoint[0]].points[state.selectedPoint[1]].px : "";
        projectedPosYInput.disabled = !pointSelected;
        projectedPosYInput.value = pointSelected ? state.frames[state.selectedPoint[0]].points[state.selectedPoint[1]].py : "";

        projectedPosCopyInput.disabled = !pointSelected;

        precisionInput.disabled = !pointSelected;
        precisionInput.value = pointSelected ? state.frames[state.selectedPoint[0]].points[state.selectedPoint[1]].precision ?? 1 : "";

        fillSelectOptions(lineSelect, "lines", state.selectedLine);

        for (let frameIndex = 0; frameIndex < frames.length; frameIndex++) {
            frames[frameIndex].imageNameLabel.innerText = state.frames[frameIndex].name;
            frames[frameIndex].timeInput.value = state.frames[frameIndex].time;
            frames[frameIndex].timeLockedInput.checked = state.frames[frameIndex].timeLocked;
            frames[frameIndex].mainInput.checked = frameIndex === state.mainFrameIndex;
        }

        brightnessInput.value = brightnessFunctionInv(state.brightness);
        brightnessValueLabel.innerText = `${state.brightness}x`;

        showGridInput.checked = state.showGrid;
        showBlurInput.checked = state.showBlur;
        showProjectedInput.checked = state.showProjected;
        offsetBy01Input.checked = state.offsetBy01;

        cameraPosXInput.value = state.cameraX;
        cameraPosYInput.value = state.cameraY;
        cameraPosZInput.value = state.cameraZ;
        cameraSpeedXInput.value = state.cameraSpeedX;
        cameraSpeedYInput.value = state.cameraSpeedY;
        cameraSpeedZInput.value = state.cameraSpeedZ;
        cameraSpeedWInput.value = state.cameraSpeedW;
        cameraSpeedFInput.value = state.cameraSpeedF;
        cameraSpeedRInput.value = state.cameraSpeedR;
        cameraRotYawInput.value = state.cameraYaw;
        cameraRotPitchInput.value = state.cameraPitch;
        cameraFovInput.value = state.cameraFov;

        cameraRotSpeedYawInput.value = state.cameraYawSpeed;
        cameraRotSpeedPitchInput.value = state.cameraPitchSpeed;

        cameraPosXLockedInput.checked = state.cameraXLocked;
        cameraPosYLockedInput.checked = state.cameraYLocked;
        cameraPosZLockedInput.checked = state.cameraZLocked;
        cameraSpeedXLockedInput.checked = state.cameraSpeedXLocked;
        cameraSpeedYLockedInput.checked = state.cameraSpeedYLocked;
        cameraSpeedZLockedInput.checked = state.cameraSpeedZLocked;
        cameraSpeedWLockedInput.checked = state.cameraSpeedWLocked;
        cameraSpeedFLockedInput.checked = state.cameraSpeedFLocked;
        cameraSpeedRLockedInput.checked = state.cameraSpeedRLocked;
        cameraRotYawLockedInput.checked = state.cameraYawLocked;
        cameraRotPitchLockedInput.checked = state.cameraPitchLocked;
        cameraFovLockedInput.checked = state.cameraFovLocked;

        imageScaleInput.value = state.imageScale;
        imageScaleLockedInput.checked = state.imageScaleLocked;

        screenWidthInput.value = state.screenWidth;
        screenHeightInput.value = state.screenHeight;
        screenWidthLockedInput.checked = state.screenWidthLocked;
        screenHeightLockedInput.checked = state.screenHeightLocked;

        frameCenterDxInput.value = state.frameCenterDx;
        frameCenterDyInput.value = state.frameCenterDy;
        frameCenterDxLockedInput.checked = state.frameCenterDxLocked;
        frameCenterDyLockedInput.checked = state.frameCenterDyLocked;

        padLeftInput.value = (state.screenWidth - imageWidth * state.imageScale) / 2 + state.frameCenterDx;
        padRightInput.value = (state.screenWidth - imageWidth * state.imageScale) / 2 - state.frameCenterDx;
        padTopInput.value = (state.screenHeight - imageHeight * state.imageScale) / 2 + state.frameCenterDy;
        padBottomInput.value = (state.screenHeight - imageHeight * state.imageScale) / 2 - state.frameCenterDy;
        padLeftLockedInput.checked = state.padLeftLocked;
        padRightLockedInput.checked = state.padRightLocked;
        padTopBottomLockedInput.checked = state.padTopBottomLocked;

        zoomCenterSpeedXInput.value = state.zoomCenterSpeedX;
        zoomCenterSpeedYInput.value = state.zoomCenterSpeedY;
        zoomCenterSpeedXLockedInput.checked = state.zoomCenterSpeedXLocked;
        zoomCenterSpeedYLockedInput.checked = state.zoomCenterSpeedYLocked;
        
        zoomSpeedInput.value = state.zoomSpeed;
        zoomSpeedLockedInput.checked = state.zoomSpeedLocked;

        reversalMethodSelect.value = state.reversalMethod;
        iterationsInput.value = state.iterations;

        if (imageWidth !== null) {
            const constants = projectConstants();
            const variables = projectVariables();
            const frames = projectFrames();
            const error = projectedError(constants, variables, frames);
            errorLabel.innerText = `${error} = ${Math.sqrt(error)}^2`;
        } else {
            errorLabel.innerText = "";
        }

        moveWorldXInput.value = state.moveWorldX;
        moveWorldYInput.value = state.moveWorldY;
        moveWorldZInput.value = state.moveWorldZ;

        stateTextarea.innerText = JSON.stringify(state);

        // axis1IndexSelect.selectedIndex = axis1[0];
        // axis1RangeInput.value = axis1[1];
        // axis2IndexSelect.selectedIndex = axis2[0];
        // axis2RangeInput.value = axis2[1];

        // maxErrorInput.value = maxError;
    }

    function projectConstants() {
        return [
            state.offsetBy01, // offsetBy0_1
            imageWidth, // imageWidth
            imageHeight, // imageHeight
            state.cameraYawSpeed * (Math.PI / 180), // cameraYawSpeed
            state.cameraPitchSpeed * (Math.PI / 180), // cameraPitchSpeed
        ];
    }

    function projectVariables() {
        return [
            state.cameraX, // cameraX
            state.cameraY, // cameraY
            state.cameraZ, // cameraZ
            state.cameraSpeedX, // cameraSpeedX
            state.cameraSpeedY, // cameraSpeedY
            state.cameraSpeedZ, // cameraSpeedZ
            state.cameraSpeedW, // cameraSpeedW
            state.cameraSpeedF, // cameraSpeedF
            state.cameraSpeedR, // cameraSpeedR
            state.cameraYaw * (Math.PI / 180), // cameraYaw
            state.cameraPitch * (Math.PI / 180), // cameraPitch
            state.cameraFov * (Math.PI / 180), // cameraFov
            state.imageScale, // imageScale
            state.screenHeight, // screenHeight
            state.frameCenterDx, // screenMainFrameCenterDx
            state.frameCenterDy, // screenMainFrameCenterDy
            state.zoomCenterSpeedX, // screenFrameCenterSpeedX
            state.zoomCenterSpeedY, // screenFrameCenterSpeedY
            state.zoomSpeed, // screenZoomSpeed
            ...state.frames.map((frame) => frame.time - state.frames[state.mainFrameIndex].time), // times
        ];
    }

    function projectVariablesLocked() {
        return [
            state.cameraXLocked, // cameraX
            state.cameraYLocked, // cameraY
            state.cameraZLocked, // cameraZ
            state.cameraSpeedXLocked, // cameraSpeedX
            state.cameraSpeedYLocked, // cameraSpeedY
            state.cameraSpeedZLocked, // cameraSpeedZ
            state.cameraSpeedWLocked, // cameraSpeedW
            state.cameraSpeedFLocked, // cameraSpeedF
            state.cameraSpeedRLocked, // cameraSpeedR
            state.cameraYawLocked, // cameraYaw
            state.cameraPitchLocked, // cameraPitch
            state.cameraFovLocked, // cameraFov
            state.imageScaleLocked || (state.screenWidthLocked && (state.frameCenterDxLocked + state.padLeftLocked + state.padRightLocked >= 2)) || (state.screenHeightLocked && state.padTopBottomLocked), // imageScale
            state.screenHeightLocked || (state.imageScaleLocked && state.padTopBottomLocked), // screenHeight
            state.frameCenterDxLocked || (state.padRightLocked + state.padLeftLocked + state.screenWidthLocked >= 2), // screenMainFrameCenterDx
            state.frameCenterDyLocked || state.padTopBottomLocked, // screenMainFrameCenterDy
            state.zoomCenterSpeedXLocked, // screenFrameCenterSpeedX
            state.zoomCenterSpeedYLocked, // screenFrameCenterSpeedY
            state.zoomSpeedLocked, // screenZoomSpeed
            ...state.frames.map((frame) => frame.timeLocked), // times
        ];
    }

    function projectFrames() {
        return state.frames.map((frame) => frame.points.map((point) => [[ point.wx, point.wy, point.wz ], [ point.px, point.py ], point.precision ?? 1 ]));
    }

    /**
     * 
     * @param {number} frameIndex 
     * @returns {{ screenToCanvasTransform: DOMMatrix, frameToCanvasTransform: DOMMatrix }}
     */
    function getToCanvasTransforms(frameIndex) {
        const transform = new DOMMatrix([ 1, 0, 0, 1, 0, 0 ]);

        const screenMainFrameWidth = imageWidth * state.imageScale;
        const screenMainFrameHeight = imageHeight * state.imageScale;
        const screenCanvasCenterX = state.screenWidth / 2 + screenCanvasCenterDx;
        const screenCanvasCenterY = state.screenHeight / 2 + screenCanvasCenterDy;

        const canvasScreenHeight = 720;
        const screenToCanvasZoom = screenToCanvasZoomMult * canvasScreenHeight / state.screenHeight;

        transform.translateSelf(frames[frameIndex].canvas.width / 2, frames[frameIndex].canvas.height / 2);
        transform.scaleSelf(screenToCanvasZoom, screenToCanvasZoom);
        // transform.translateSelf(-roundPx(screenCanvasCenterX), -roundPx(screenCanvasCenterY));
        transform.translateSelf(-screenCanvasCenterX, -screenCanvasCenterY);
        
        const deltaTime = state.frames[frameIndex].time - state.frames[state.mainFrameIndex].time;
        const screenMainFrameCenterX = state.screenWidth / 2 + state.frameCenterDx;
        const screenMainFrameCenterY = state.screenHeight / 2 + state.frameCenterDy;
        const screenFrameCenterX = screenMainFrameCenterX + state.zoomCenterSpeedX * deltaTime;
        const screenFrameCenterY = screenMainFrameCenterY + state.zoomCenterSpeedY * deltaTime;
        const frameZoom = (screenMainFrameHeight - state.zoomSpeed * deltaTime) / screenMainFrameHeight;
        
        const screenToCanvasTransform = DOMMatrix.fromMatrix(transform);
        
        transform.translateSelf(screenFrameCenterX, screenFrameCenterY);
        transform.scaleSelf(frameZoom, frameZoom);
        transform.translateSelf(-screenMainFrameWidth / 2, -screenMainFrameHeight / 2);
        transform.scaleSelf(state.imageScale, state.imageScale);

        return { screenToCanvasTransform, frameToCanvasTransform: transform };
    }

    function redraw() {
        // const framesElementRect = divFrames.getBoundingClientRect();

        for (let frameIndex = 0; frameIndex < frames.length; frameIndex++) {
            const frame = frames[frameIndex];
            const canvas = frame.canvas;
            const context = frame.context;

            // const canvasRect = canvas.getBoundingClientRect();

            // if (
            //     canvasRect.right < framesElementRect.left ||
            //     canvasRect.left > framesElementRect.right ||
            //     canvasRect.bottom < framesElementRect.top ||
            //     canvasRect.top > framesElementRect.bottom
            // ) {
            //     continue;
            // }

            canvas.width = canvas.clientWidth;
            canvas.height = canvas.clientHeight;
            
            context.resetTransform();
            context.clearRect(0, 0, canvas.width, canvas.height);
            
            if (frame.image === null) continue;
            
            context.imageSmoothingEnabled = state.showBlur;

            const { screenToCanvasTransform, frameToCanvasTransform } = getToCanvasTransforms(frameIndex);
            const screenToCanvasZoom = screenToCanvasTransform.m11;
            const frameToCanvasZoom = frameToCanvasTransform.m11;

            context.setTransform(frameToCanvasTransform);

            context.drawImage(frame.offscreenCanvas, 0, 0, imageWidth, imageHeight);
            
            context.setTransform(screenToCanvasTransform);
            
            context.lineWidth = 1 / screenToCanvasZoom;
            context.strokeStyle = "#ccc";
            
            context.strokeRect(-0.5 / screenToCanvasZoom, -0.5 / screenToCanvasZoom, state.screenWidth + 1 / screenToCanvasZoom, state.screenHeight + 1 / screenToCanvasZoom);

            context.beginPath();
            context.moveTo(state.screenWidth / 2 - 8, state.screenHeight / 2);
            context.lineTo(state.screenWidth / 2 + 8, state.screenHeight / 2);
            context.moveTo(state.screenWidth / 2, state.screenHeight / 2 - 8);
            context.lineTo(state.screenWidth / 2, state.screenHeight / 2 + 8);
            context.stroke();

            context.setTransform(frameToCanvasTransform);

            if (state.showGrid && Math.abs(frameToCanvasZoom) >= 8) {
                const canvasToFrameTransform = frameToCanvasTransform.inverse();

                const { x: frameCanvasMinX, y: frameCanvasMinY } = canvasToFrameTransform.transformPoint(new DOMPoint(0, 0));
                const { x: frameCanvasMaxX, y: frameCanvasMaxY } = canvasToFrameTransform.transformPoint(new DOMPoint(canvas.width, canvas.height));
                const clampedFrameCanvasMinX = Math.max(Math.floor(Math.min(frameCanvasMinX, frameCanvasMaxX)), 0);
                const clampedFrameCanvasMinY = Math.max(Math.floor(Math.min(frameCanvasMinY, frameCanvasMaxY)), 0);
                const clampedFrameCanvasMaxX = Math.min(Math.ceil(Math.max(frameCanvasMinX, frameCanvasMaxX)), imageWidth);
                const clampedFrameCanvasMaxY = Math.min(Math.ceil(Math.max(frameCanvasMinY, frameCanvasMaxY)), imageHeight);

                context.beginPath();

                for (let x = clampedFrameCanvasMinX; x <= clampedFrameCanvasMaxX; x++) {
                    context.moveTo(x, clampedFrameCanvasMinY);
                    context.lineTo(x, clampedFrameCanvasMaxY);
                }

                for (let y = clampedFrameCanvasMinY; y <= clampedFrameCanvasMaxY; y++) {
                    context.moveTo(clampedFrameCanvasMinX, y);
                    context.lineTo(clampedFrameCanvasMaxX, y);
                }

                context.lineWidth = 1 / Math.abs(frameToCanvasZoom);
                context.strokeStyle = "#aaa";
                context.setLineDash([1 / Math.abs(frameToCanvasZoom)])
                context.stroke();
            }
            context.setLineDash([]);
            
            function drawPoint(centerPath, outlinePath, smallOutlinePath, outlineEdgePath, pointCanvasX, pointCanvasY, selected, small) {
                centerPath.addPath((() => {
                    const path = new Path2D();
                    path.arc(pointCanvasX, pointCanvasY, 1, 0, 2 * Math.PI);
                    return path;
                })());

                if (selected) {
                    const outerRadius = !small ? CONFIG.pointOuterRadius : CONFIG.pointOuterRadius - (CONFIG.pointOuterRadius - CONFIG.pointInnerRadius - CONFIG.pointEdgeWidth * 2) * 0.5;

                    (small ? smallOutlinePath : outlinePath).addPath((() => {
                        const path = new Path2D();
                        path.arc(pointCanvasX, pointCanvasY, (CONFIG.pointInnerRadius + outerRadius) * 0.5, 0, 2 * Math.PI);
                        return path;
                    })());
                    
                    outlineEdgePath.addPath((() => {
                        const path = new Path2D();
                        path.arc(pointCanvasX, pointCanvasY, CONFIG.pointInnerRadius + CONFIG.pointEdgeWidth * 0.5, 0, 2 * Math.PI);
                        return path;
                    })());
                    
                    outlineEdgePath.addPath((() => {
                        const path = new Path2D();
                        path.arc(pointCanvasX, pointCanvasY, outerRadius - CONFIG.pointEdgeWidth * 0.5, 0, 2 * Math.PI);
                        return path;
                    })());
                } else {
                    outlineEdgePath.addPath((() => {
                        const path = new Path2D();
                        path.arc(pointCanvasX, pointCanvasY, CONFIG.pointInnerRadius + CONFIG.pointEdgeWidth * 0.5, 0, 2 * Math.PI);
                        return path;
                    })());
                }
            }

            const projectedCenterPath = new Path2D();
            const projectedOutlinePath = new Path2D();
            const projectedSmallOutlinePath = new Path2D();

            const centerPath = new Path2D();
            const outlinePath = new Path2D();
            const smallOutlinePath = new Path2D();

            const outlineEdgePath = new Path2D();

            for (let pointIndex = 0; pointIndex < state.frames[frameIndex].points.length; pointIndex++) {
                let selected = false;
                if (state.selectedPoint !== null) {
                    const { wx, wy, wz } = state.frames[state.selectedPoint[0]].points[state.selectedPoint[1]];
                    if (
                        state.frames[frameIndex].points[pointIndex].wx === wx && 
                        state.frames[frameIndex].points[pointIndex].wy === wy && 
                        state.frames[frameIndex].points[pointIndex].wz === wz
                    ) {
                        selected = true;
                    }
                }
                if (state.selectedLine !== null) {
                    for (const linePointIndex of state.frames[state.selectedLine[0]].lines[state.selectedLine[1]].points) {
                        const { wx, wy, wz } = state.frames[state.selectedLine[0]].points[linePointIndex];
                        if (
                            state.frames[frameIndex].points[pointIndex].wx === wx && 
                            state.frames[frameIndex].points[pointIndex].wy === wy && 
                            state.frames[frameIndex].points[pointIndex].wz === wz
                        ) {
                            selected = true;
                            break;
                        }
                    }
                }
                const small = selected && !(state.selectedPoint !== null && state.selectedPoint[0] === frameIndex && state.selectedPoint[1] === pointIndex);
                
                const point = state.frames[frameIndex].points[pointIndex];
                const pointFrameX = point.px;
                const pointFrameY = point.py;
                const { x: pointCanvasX, y: pointCanvasY } = frameToCanvasTransform.transformPoint(new DOMPoint(pointFrameX, pointFrameY));
                drawPoint(centerPath, outlinePath, smallOutlinePath, outlineEdgePath, pointCanvasX, pointCanvasY, selected, small);

                if (state.showProjected) {
                    const constants = projectConstants();
                    const variables = projectVariables();

                    const [ projectedPointFrameX, projectedPointFrameY ] = project(constants, variables, frameIndex, [ point.wx, point.wy, point.wz ]);
                    const { x: projectedPointCanvasX, y: projectedPointCanvasY } = frameToCanvasTransform.transformPoint(new DOMPoint(projectedPointFrameX, projectedPointFrameY));
                    drawPoint(projectedCenterPath, projectedOutlinePath, projectedSmallOutlinePath, outlineEdgePath, projectedPointCanvasX, projectedPointCanvasY, selected, small);
                }
            }

            /**
             * 
             * @param {Path2D} linePath 
             * @param {Line} line 
             * @param {number[]} splitPath 
             * @param {number[]} oppositeSplitPath 
             */
            function drawSplitPath(linePath, line, splitPath, oppositeSplitPath) {
                const firstPixel = line.pixels[splitPath[0]];
                const lastPixel = line.pixels[splitPath[splitPath.length - 1]]
                const firstOppositePixel = line.pixels[oppositeSplitPath[0]];
                const lastOppositePixel = line.pixels[oppositeSplitPath[oppositeSplitPath.length - 1]]

                const startDirX = lastOppositePixel.px - firstPixel.px;
                const startDirY = lastOppositePixel.py - firstPixel.py;
                const startDirLen = Math.sqrt(startDirX * startDirX + startDirY * startDirY);

                const endDirX = lastPixel.px - firstOppositePixel.px;
                const endDirY = lastPixel.py - firstOppositePixel.py;
                const endDirLen = Math.sqrt(endDirX * endDirX + endDirY * endDirY);

                linePath.moveTo((firstPixel.px + 0.5) - startDirX / startDirLen * 1000, (firstPixel.py + 0.5) - startDirY / startDirLen * 1000);
                for (let i = 0; i < splitPath.length; i++) {
                    const pixel = line.pixels[splitPath[i]];
                    linePath.lineTo(pixel.px + 0.5, pixel.py + 0.5);
                }
                linePath.lineTo((lastPixel.px + 0.5) + endDirX / endDirLen * 1000, (lastPixel.py + 0.5) + endDirY / endDirLen * 1000);
            }

            const lineCenterPath = new Path2D();
            const selectedLineCenterPath = new Path2D();
            const lineSplitPath = new Path2D();
            const pixelEmptyPath = new Path2D();
            const pixelFilledPath = new Path2D();

            for (let lineIndex = 0; lineIndex < state.frames[frameIndex].lines.length; lineIndex++) {
                const line = state.frames[frameIndex].lines[lineIndex];
                const lineData = linesData[frameIndex][lineIndex];

                const lineSelected = state.selectedLine !== null && state.selectedLine[0] === frameIndex && state.selectedLine[1] === lineIndex;

                const abc = calculateBestLineABCNorm(frameIndex, lineIndex);
                if (abc !== null) {
                    const { a, b, c } = abc;

                    let x1, y1, x2, y2;

                    // line is mostly horizontal
                    if (a * a < imageWidth / imageHeight) {
                        x1 = 0;
                        y1 = -(a * x1 + c) / b;
                        if (y1 < 0) {
                            y1 = 0;
                            x1 = -(b * y1 + c) / a;
                        } else if (y1 > imageHeight) {
                            y1 = imageHeight;
                            x1 = -(b * y1 + c) / a;
                        }
                        x2 = imageWidth;
                        y2 = -(a * x2 + c) / b;
                        if (y2 < 0) {
                            y2 = 0;
                            x2 = -(b * y2 + c) / a;
                        } else if (y2 > imageHeight) {
                            y2 = imageHeight;
                            x2 = -(b * y2 + c) / a;
                        }
                    } else {
                        y1 = 0;
                        x1 = -(b * y1 + c) / a;
                        if (x1 < 0) {
                            x1 = 0;
                            y1 = -(a * x1 + c) / b;
                        } else if (x1 > imageWidth) {
                            x1 = imageWidth;
                            y1 = -(a * x1 + c) / b;
                        }
                        y2 = imageHeight;
                        x2 = -(b * y2 + c) / a;
                        if (x2 < 0) {
                            x2 = 0;
                            y2 = -(a * x2 + c) / b;
                        } else if (x2 > imageWidth) {
                            x2 = imageWidth;
                            y2 = -(a * x2 + c) / b;
                        }
                    }

                    const path = lineSelected ? selectedLineCenterPath : lineCenterPath;
                    path.moveTo(x1, y1);
                    path.lineTo(x2, y2);
                }
                
                if (lineSelected) {
                    for (const pixel of line.pixels) {
                        (pixel.filled ? pixelFilledPath : pixelEmptyPath).addPath((() => {
                            const path = new Path2D();
                            path.moveTo(pixel.px + 0.25, pixel.py + 0.25);
                            path.lineTo(pixel.px + 0.75, pixel.py + 0.75);
                            path.moveTo(pixel.px + 0.75, pixel.py + 0.25);
                            path.lineTo(pixel.px + 0.25, pixel.py + 0.75);
                            return path;
                        })());
                    }

                    if (lineData !== null) {
                        drawSplitPath(lineSplitPath, line, lineData.emptySplitPath, lineData.filledSplitPath);
                        drawSplitPath(lineSplitPath, line, lineData.filledSplitPath, lineData.emptySplitPath);
                    }
                }
            }

            if (state.selectedPoint !== null) {
                // const polygon = calculatePointPolygon(state.selectedPoint);

                // context.moveTo(polygon[0].x, polygon[0].y);
                // for (let i = 1; i < polygon.length; i++) {
                //     context.lineTo(polygon[i].x, polygon[i].y);
                // }
                // context.closePath();

                // context.fillStyle = "#ff0b";
                // context.fill();
            }
            
            context.lineWidth = 1 / Math.abs(frameToCanvasZoom);
            context.strokeStyle = "#00fb";
            context.stroke(lineSplitPath);
            
            context.lineWidth = 1 / Math.abs(frameToCanvasZoom);
            context.strokeStyle = "#f00b";
            context.stroke(pixelEmptyPath);
            
            context.lineWidth = 1 / Math.abs(frameToCanvasZoom);
            context.strokeStyle = "#0f0b";
            context.stroke(pixelFilledPath);
            
            context.lineWidth = 1 / Math.abs(frameToCanvasZoom);
            context.strokeStyle = "#f904";
            context.stroke(lineCenterPath);
            
            context.lineWidth = 1 / Math.abs(frameToCanvasZoom);
            context.strokeStyle = "#f90b";
            context.stroke(selectedLineCenterPath);

            context.resetTransform();
            
            context.lineWidth = CONFIG.pointEdgeWidth;
            context.strokeStyle = "#222b";
            context.stroke(outlineEdgePath);

            if (state.showProjected) {
                context.fillStyle = "#00f";
                context.fill(projectedCenterPath);

                context.lineWidth = CONFIG.pointOuterRadius - CONFIG.pointInnerRadius - CONFIG.pointEdgeWidth * 2;
                context.strokeStyle = "#0afb";
                context.stroke(projectedOutlinePath);

                context.lineWidth = (CONFIG.pointOuterRadius - CONFIG.pointInnerRadius - CONFIG.pointEdgeWidth * 2) * 0.5;
                context.strokeStyle = "#0afb";
                context.stroke(projectedSmallOutlinePath);
            }

            context.fillStyle = "#f00";
            context.fill(centerPath);

            context.lineWidth = CONFIG.pointOuterRadius - CONFIG.pointInnerRadius - CONFIG.pointEdgeWidth * 2;
            context.strokeStyle = "#0f0b";
            context.stroke(outlinePath);

            context.lineWidth = (CONFIG.pointOuterRadius - CONFIG.pointInnerRadius - CONFIG.pointEdgeWidth * 2) * 0.5;
            context.strokeStyle = "#0f0b";
            context.stroke(smallOutlinePath);
        }

        // errorCanvas.width = errorCanvas.clientWidth / 4;
        // errorCanvas.height = errorCanvas.clientHeight / 4;

        // const worldPoints = points.map((point) => {
        //     return [ point.wx, point.wy, point.wz ];
        // });
        // const projectedPoints = points.map((point) => {
        //     return [ point.px, point.py ];
        // });

        // const imageData = errorContext.createImageData(errorCanvas.width, errorCanvas.height);

        // for (let x = 0; x < imageData.width; x++) {
        //     for (let y = 0; y < imageData.height; y++) {
        //         const d1 = (x / (imageData.width - 1) - 0.5) * axis1[1];
        //         const d2 = (y / (imageData.height - 1) - 0.5) * axis2[1];

        //         const variables = [ cameraX, cameraY, cameraZ, cameraYaw, cameraPitch, cameraFov ];
        //         variables[axis1[0]] += d1;
        //         variables[axis2[0]] += d2;
        //         variables[3] *= (Math.PI / 180);
        //         variables[4] *= (Math.PI / 180);
        //         variables[5] *= (Math.PI / 180);

        //         const error = projectedError([ offsetBy0_1, loadedImage.width, loadedImage.height ], variables, worldPoints, projectedPoints);
        //         const scaledError = error / maxError;
        //         const clampedError = scaledError < 1 ? scaledError / 2 : 1;
        //         const colorValue = Math.min(Math.round(clampedError * 255, 255));
                
        //         imageData.data[((y * imageData.width) + x) * 4 + 0] = colorValue;
        //         imageData.data[((y * imageData.width) + x) * 4 + 1] = colorValue;
        //         imageData.data[((y * imageData.width) + x) * 4 + 2] = colorValue;
        //         imageData.data[((y * imageData.width) + x) * 4 + 3] = 255;
        //     }
        // }

        // errorContext.putImageData(imageData, 0, 0);
    }

    requestRedraw();
});