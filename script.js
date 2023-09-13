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

function project(constants, variables, worldPoint) {
    const [ offsetBy0_1, imageSizeX, imageSizeY ] = constants;
    const [ x, y, z, yaw, pitch, fov ] = variables;
    
    const sinYaw = Math.sin(yaw);
    const cosYaw = Math.cos(yaw);
    const sinPitch = Math.sin(-pitch);
    const cosPitch = Math.cos(-pitch);

    const f = 1 / Math.tan(fov * 0.5);
    const aspectRatioInv = imageSizeY / imageSizeX;

    // const viewDistance = 8 * 16 * 4;
    // const cameraDepth = 0.05;
    // const zm = (viewDistance + cameraDepth) / (cameraDepth - viewDistance);
    // const za = 2 * viewDistance * cameraDepth / (cameraDepth - viewDistance);

    const [ x0, y0, z0 ] = worldPoint;

    // Translate by -camera_pos
    const x1 = x0 - x;
    const y1 = y0 - y;
    const z1 = z0 - z;

    // Rotate around Y by yaw
    const x2 = x1 * cosYaw + z1 * sinYaw;
    const y2 = y1;
    const z2 = x1 * -sinYaw + z1 * cosYaw;
    
    // Rotate around X by -pitch
    const x3 = x2;
    const y3 = y2 * cosPitch + z2 * -sinPitch;
    const z3 = y2 * sinPitch + z2 * cosPitch;

    const x4 = x3 * f * aspectRatioInv;
    const y4 = y3 * f;
    // const z4 = z3 * zm + za;
    const w4 = -z3 + (offsetBy0_1 ? -0.1 : 0);
    
    const w4Inv = w4 === 0 ? 0 : 1 / w4;
    const x5 = (x4 * w4Inv + 1) * (imageSizeX * 0.5);
    const y5 = (y4 * w4Inv + 1) * (imageSizeY * 0.5);

    return [ x5, y5 ];
}

function projectedError(constants, variables, worldPoints, projectedPoints) {
    const [ offsetBy0_1, imageSizeX, imageSizeY ] = constants;
    const [ x, y, z, yaw, pitch, fov ] = variables;
    
    const sinYaw = Math.sin(yaw);
    const cosYaw = Math.cos(yaw);
    const sinPitch = Math.sin(-pitch);
    const cosPitch = Math.cos(-pitch);

    const f = 1 / Math.tan(fov * 0.5);
    const aspectRatioInv = imageSizeY / imageSizeX;

    // const viewDistance = 8 * 16 * 4;
    // const cameraDepth = 0.05;
    // const zm = (viewDistance + cameraDepth) / (cameraDepth - viewDistance);
    // const za = 2 * viewDistance * cameraDepth / (cameraDepth - viewDistance);

    let totalError = 0;

    for (let i = 0; i < worldPoints.length; i++) {
        const [ x0, y0, z0 ] = worldPoints[i];

        // Translate by -camera_pos
        const x1 = x0 - x;
        const y1 = y0 - y;
        const z1 = z0 - z;

        // Rotate around Y by yaw
        const x2 = x1 * cosYaw + z1 * sinYaw;
        const y2 = y1;
        const z2 = x1 * -sinYaw + z1 * cosYaw;
        
        // Rotate around X by -pitch
        const x3 = x2;
        const y3 = y2 * cosPitch + z2 * -sinPitch;
        const z3 = y2 * sinPitch + z2 * cosPitch;

        const x4 = x3 * f * aspectRatioInv;
        const y4 = y3 * f;
        // const z4 = z3 * zm + za;
        const w4 = -z3 + (offsetBy0_1 ? -0.1 : 0);

        const w4Inv = w4 === 0 ? 0 : 1 / w4;
        const x5 = (x4 * w4Inv + 1) * (imageSizeX * 0.5);
        const y5 = (y4 * w4Inv + 1) * (imageSizeY * 0.5);

        const [ px, py ] = projectedPoints[i];

        const dpx = x5 - px;
        const dpy = y5 - py;

        const error = Math.sqrt(dpx * dpx + dpy * dpy);

        totalError += error * error;
    }

    return Math.sqrt(totalError);
}

function reverseProjection(constants, startingVariables, maxSteps, worldPoints, projectedPoints, iterations) {
    const variables = Array.from(startingVariables);
    const steps = Array.from(maxSteps);

    for (let i = 0; i < iterations; i++) {
        for (let j = 0; j < variables.length; j++) {
            if (steps[j] === 0) continue;

            let minError = Number.MAX_VALUE;
            let minStepIndex = 0;

            for (let k = -1; k <= 1; k += 1) {
                const value = variables[j];
                variables[j] += steps[j] * k;
                const error = projectedError(constants, variables, worldPoints, projectedPoints);
                variables[j] = value;
                if (error < minError) {
                    minError = error;
                    minStepIndex = k;
                }
            }

            if (minStepIndex === 0) {
                steps[j] *= 0.5;
            } else {
                variables[j] = variables[j] + steps[j] * minStepIndex;
            }
        }
    }

    return variables;
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
     * @type {HTMLImageElement | null}
     */
    let loadedImage = null;

    /**
     * @typedef {{
     *     wx: number,
     *     wy: number,
     *     wz: number,
     *     px: number,
     *     py: number,
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
     * @type {{
     *     points: Point[],
     *     selectedPoint: number | null,
     *     selectedPointHistory: number[],
     *     lines: Line[],
     *     selectedLine: number | null,
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
     *     cameraYaw: number,
     *     cameraYawLocked: boolean,
     *     cameraPitch: number,
     *     cameraPitchLocked: boolean,
     *     cameraFov: number,
     *     cameraFovLocked: boolean,
     *     iterations: number,
     * }}
     */
    let state = {
        points: [],
        selectedPoint: null,
        selectedPointHistory: [],
        lines: [],
        selectedLine: null,
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
        cameraYaw: 0,
        cameraYawLocked: false,
        cameraPitch: 0,
        cameraPitchLocked: false,
        cameraFov: 70,
        cameraFovLocked: false,
        iterations: 1000,
    };

    /**
     * @typedef {{
     *     emptySplitPath: number[],
     *     filledSplitPath: number[],
     * }} LineData
     */

    /**
     * @type {(LineData | null)[]}
     */
    let linesData = [];

    /**
     * 
     * @param {HTMLImageElement} image 
     */
    function setLoadedImage(image) {
        loadedImage = image;

        if (image !== null) {
            centerX = loadedImage.width / 2;
            centerY = loadedImage.height / 2;
            zoomIndex = Math.min(Math.max(-Math.ceil(Math.log2(Math.max(loadedImage.width / canvas.clientWidth, loadedImage.height / canvas.clientHeight)) * 2) / 2, CONFIG.zoomIndexMin), CONFIG.zoomIndexMax);
            zoom = Math.pow(2, zoomIndex);
        }
    }

    /**
     * 
     * @param {number} wx 
     * @param {number} wy 
     * @param {number} wz 
     * @param {number} px 
     * @param {number} py 
     * @returns {number}
     */
    function createPoint(wx, wy, wz, px, py) {
        state.points.push({
            wx: wx,
            wy: wy,
            wz: wz,
            px: px,
            py: py,
        });

        return state.points.length - 1;
    }

    /**
     * 
     * @param {number} pointIndex 
     */
    function removePoint(pointIndex) {
        state.points.splice(pointIndex, 1);
        
        if (state.selectedPoint === pointIndex) {
            selectPoint(null);
        } else if (state.selectedPoint > pointIndex) {
            state.selectedPoint -= 1;
        }

        for (let i = state.selectedPointHistory.length - 1; i >= 0; i--) {
            if (state.selectedPointHistory[i] === pointIndex) {
                state.selectedPointHistory.splice(i, 1);
            } else if (state.selectedPointHistory[i] > pointIndex) {
                state.selectedPointHistory[i] -= 1;
            }
        }

        for (const line of state.lines) {
            const i = line.points.indexOf(pointIndex);
            if (i !== -1) {
                line.points.splice(i, 1);
            }
        }

        updateAllLineData();
    }
    
    /**
     * 
     * @param {number | null} pointIndex 
    */
   function selectPoint(pointIndex) {
        if (state.selectedPoint === pointIndex) return;

        state.selectedPoint = pointIndex;
        
        if (pointIndex !== null) {
            const i = state.selectedPointHistory.indexOf(pointIndex);
            if (i !== -1) state.selectedPointHistory.splice(i, 1);
            state.selectedPointHistory.push(pointIndex);
        }

        draggedPointIndex = null;
    }

    /**
     * 
     * @param {number} pointIndex 
     * @param {number} wx 
     * @param {number} wy 
     * @param {number} wz 
     */
    function movePointWorld(pointIndex, wx, wy, wz) {
        const point = state.points[pointIndex];
        point.wx = wx;
        point.wy = wy;
        point.wz = wz;
    }

    /**
     * 
     * @param {number} pointIndex 
     * @param {number} px 
     * @param {number} py 
     */
    function movePointProjected(pointIndex, px, py) {
        const point = state.points[pointIndex];
        point.px = px;
        point.py = py;
    }

    /**
     * 
     * @returns {number}
     */
    function createLine() {
        state.lines.push({
            points: [],
            pixels: [],
        });

        linesData.push(null);

        return state.lines.length - 1;
    }

    /**
     * 
     * @param {number} lineIndex 
     */
    function removeLine(lineIndex) {
        state.lines.splice(lineIndex, 1);

        if (state.selectedLine === lineIndex) {
            state.selectedLine = null;
        } else if (state.selectedLine > lineIndex) {
            state.selectedLine -= 1;
        }
        
        linesData.splice(lineIndex, 1);
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
     * @param {number} lineIndex 
     * @returns {LineData | null}
     */
    function calculateLineData(lineIndex) {
        const line = state.lines[lineIndex];

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
     * @param {number} lineIndex 
     */
    function updateLineData(lineIndex) {
        linesData[lineIndex] = calculateLineData(lineIndex);
    }

    /**
     * 
     * @param {number} lineIndex 
     */
    function updateAllLineData() {
        linesData.length = 0;
        for (let i = 0; i < state.lines.length; i++) {
            linesData.push(calculateLineData(i));
        }
    }

    /**
     * 
     * @param {number} lineIndex 
     * @returns {{
     *     a: number,
     *     b: number,
     *     c: number,
     * } | null}
     */
    function calculateBestLineABCNorm(lineIndex) {
        const line = state.lines[lineIndex];
        const lineData = linesData[lineIndex];
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
     * @param {number} lineIndex 
     * @param {number} pointIndex 
     */
    function toggleLinePoint(lineIndex, pointIndex) {
        const line = state.lines[lineIndex];

        const i = line.points.indexOf(pointIndex);
        if (i !== -1) {
            line.points.splice(i, 1);

            if (line.points.length === 0 && line.pixels.length === 0) {
                removeLine(lineIndex);
            }
        } else {
            line.points.push(pointIndex);
        }

        updateLineData(lineIndex);
    }

    /**
     * 
     * @param {number} lineIndex 
     * @param {number} px 
     * @param {number} py 
     */
    function toggleLinePixel(lineIndex, px, py) {
        const line = state.lines[lineIndex];

        for (let i = 0; i < line.pixels.length; i++) {
            const pixel = line.pixels[i];

            if (pixel.px === px && pixel.py === py) {
                const filled = pixel.filled;
                const newFilled = filled === null ? false : filled === false ? true : null;

                if (newFilled === null) {
                    line.pixels.splice(i, 1);

                    if (line.points.length === 0 && line.pixels.length === 0) {
                        removeLine(lineIndex);
                        return;
                    }
                } else {
                    pixel.filled = newFilled;
                }

                updateLineData(lineIndex);

                return;
            }
        }

        line.pixels.push({
            px: px,
            py: py,
            filled: false,
        });

        updateLineData(lineIndex);
    }

    /**
     * 
     * @param {number} lineIndex 
     * @returns {boolean}
     */
    function validateLine(lineIndex) {
        return linesData[lineIndex] !== null;
    }

    /**
     * 
     * @param {number | null} lineIndex 
     * @returns {boolean}
     */
    function selectLine(lineIndex) {
        if (state.selectedLine === lineIndex) return true;

        if (state.selectedLine !== null) {
            if (!validateLine(state.selectedLine)) {
                const line = state.lines[state.selectedLine];

                if (line.points.length !== 0 || line.pixels.length !== 0) {
                    if (!window.confirm("The selected line is not valid. Deselecting will delete it.")) {
                        return false;
                    }
                }
    
                removeLine(state.selectedLine);
            }
        }

        state.selectedLine = lineIndex;

        return true;
    }

    /**
     * 
     * @param {Line} line 
     * @param {number} pointIndex 
     * @returns {{
     *     minDist: number,
     *     minDirX: number,
     *     minDirY: number,
     *     maxDist: number,
     *     maxDirX: number,
     *     maxDirY: number,
     * } | null}
     */
    function getLineCuts(line, pointIndex) {
        // the coordinate system of the image uses Y+ going down
        // most of the distances are signed, when they are positive the point is to the left of the line

        if (line.p0 !== pointIndex && line.p1 !== pointIndex) return null;

        const p0 = pointIndex;
        const p1 = line.p0 === pointIndex ? line.p1 : line.p0;

        const point0 = state.points[p0];
        const point1 = state.points[p1];

        // vector from the second point to the main point
        const pointDirX = point0.px - point1.px;
        const pointDirY = point0.py - point1.py;

        // the above vector rotated by 90deg facing left
        const pointDirNormX = pointDirY;
        const pointDirNormY = -pointDirX;

        let emptyCount = 0;
        let emptyDist = 0;
        let filledCount = 0;
        let filledDist = 0;

        for (const pixel of line.pixels) {
            // Distance from the pixel to the approximate line set by the user, scaled by the length of pointDir
            const dist = pointDirNormX * ((pixel.px + 0.5) - point1.px) + pointDirNormY * ((pixel.py + 0.5) - point1.py);

            if (pixel.filled) {
                filledCount += 1;
                filledDist += dist;
            } else {
                emptyCount += 1;
                emptyDist += dist;
            }
        }

        if (emptyCount === 0 || filledCount === 0) return null;

        emptyDist /= emptyCount;
        filledDist /= filledCount;
        // are "empty" pixels to the left of the pointDir vector or to the right
        const emptyToTheLeft = emptyDist > filledDist;

        let minDist = Number.MAX_VALUE;
        let minDirX = 0;
        let minDirY = 0;
        let maxDist = -Number.MAX_VALUE;
        let maxDirX = 0;
        let maxDirY = 0;

        for (let i = 0; i < line.pixels.length; i++) {
            const pixel1 = line.pixels[i];
            const pixel1Left = pixel1.filled ^ emptyToTheLeft;

            for (let j = i + 1; j < line.pixels.length; j++) {
                const pixel2 = line.pixels[j];
                const pixel2Left = pixel2.filled ^ emptyToTheLeft;
                if (pixel1Left === pixel2Left) continue;

                // vector between 2 pixels
                let pixelDirX = (pixel2.px + 0.5) - (pixel1.px + 0.5);
                let pixelDirY = (pixel2.py + 0.5) - (pixel1.py + 0.5);

                // Flip the vector if it is not facing the main point
                const flipped = pixelDirX * pointDirX + pixelDirY * pointDirY < 0;
                if (flipped) {
                    pixelDirX *= -1;
                    pixelDirY *= -1;
                }

                const pixelDirNormX = pixelDirY;
                const pixelDirNormY = -pixelDirX;

                // Distance from the main point to the line going throught two pixels
                const dist = (pixelDirNormX * (point0.px - (pixel1.px + 0.5)) + pixelDirNormY * (point0.py - (pixel1.py + 0.5))) / Math.sqrt(pixelDirX * pixelDirX + pixelDirY * pixelDirY);

                if (pixel2Left ^ flipped) {
                    // Cut off everything to the left - sets max dist
                    if (dist > maxDist) {
                        maxDist = dist;
                        maxDirX = pixelDirX;
                        maxDirY = pixelDirY;
                    }
                } else {
                    // Cut off everything to the right - sets min dist
                    if (dist < minDist) {
                        minDist = dist;
                        minDirX = pixelDirX;
                        minDirY = pixelDirY;
                    }
                }
            }
        }

        if (minDist === Number.MAX_VALUE || maxDist === -Number.MAX_VALUE) return null;

        const minDirLen = Math.sqrt(minDirX * minDirX + minDirY * minDirY);
        const maxDirLen = Math.sqrt(maxDirX * maxDirX + maxDirY * maxDirY);

        return {
            minDist: minDist,
            minDirX: minDirX / minDirLen,
            minDirY: minDirY / minDirLen,
            maxDist: -maxDist,
            maxDirX: -maxDirX / maxDirLen,
            maxDirY: -maxDirY / maxDirLen,
        };
    }

    /**
     * @typedef {{
     *     x: number,
     *     y: number,
     * }} PolygonPoint
     */

    /**
     * @typedef {PolygonPoint[]} Polygon
     */

    /**
     * 
     * @param {Polygon} polygon 
     * @param {number} cutA 
     * @param {number} cutB 
     * @param {number} cutC 
     */
    function cutPolygon(polygon, cutA, cutB, cutC) {
        const intersections = [];

        for (let i = 0; i < polygon.length; i++) {
            const p1 = polygon[i];
            const p2 = polygon[(i + 1) % polygon.length];

            const edgeA = p2.y - p1.y;
            const edgeB = p1.x - p2.x;
            const edgeC = p2.x * p1.y - p1.x * p2.y;

            const intersectionX = (cutB * edgeC - edgeB * cutC) / (edgeB * cutA - cutB * edgeA);
            const intersectionY = (cutA * edgeC - edgeA * cutC) / (edgeA * cutB - cutA * edgeB);

            if (!Number.isFinite(intersectionX) || !Number.isFinite(intersectionY)) continue;

            const edgeLenSq = (p2.x - p1.x) * (p2.x - p1.x) + (p2.y - p1.y) * (p2.y - p1.y);
            const t = ((p2.x - p1.x) * (intersectionX - p1.x) + (p2.y - p1.y) * (intersectionY - p1.y)) / edgeLenSq;
            if (t < -1e-6 || t > 1) continue;

            intersections.push({
                x: intersectionX,
                y: intersectionY,
                i: i,
            });
        }

        if (intersections.length !== 2) return;

        const cutDirX = -cutB;
        const cutDirY = cutA;

        intersections.sort((intersection1, intersection2) => {
            const dirX = intersection2.x - intersection1.x;
            const dirY = intersection2.y - intersection1.y;
            
            return cutDirX * dirX + cutDirY * dirY;
        });

        let deleteCount = intersections[1].i - intersections[0].i;
        if (deleteCount < 0) deleteCount += polygon.length;
        deleteCount -= polygon.splice(intersections[0].i + 1, deleteCount, { x: intersections[0].x, y: intersections[0].y }, { x: intersections[1].x, y: intersections[1].y }).length;
        polygon.splice(0, deleteCount);
    }

    /**
     * 
     * @param {number} pointIndex 
     * @returns {Polygon}
     */
    function calculatePointPolygon(pointIndex) {
        const point = state.points[pointIndex];

        const polygon = [
            { x: point.px - 3, y: point.py - 3 },
            { x: point.px + 3, y: point.py - 3 },
            { x: point.px + 3, y: point.py + 3 },
            { x: point.px - 3, y: point.py + 3 },
        ];

        for (const line of state.lines) {
            const cuts = getLineCuts(line, pointIndex);
            if (cuts === null) continue;

            const minA = cuts.minDirY;
            const minB = -cuts.minDirX;
            const minC = -(point.px * minA + point.py * minB - cuts.minDist);

            const maxA = cuts.maxDirY;
            const maxB = -cuts.maxDirX;
            const maxC = -(point.px * maxA + point.py * maxB - cuts.maxDist);

            console.log(`${minA} ${minB} ${minC} ${maxA} ${maxB} ${maxC}`);

            cutPolygon(polygon, minA, minB, minC);
            cutPolygon(polygon, maxA, maxB, maxC);
        }

        return polygon;
    }

    /**
     * @type {HTMLInputElement}
     */
    const imageInput = document.getElementById("input-image");
    imageInput.addEventListener("change", () => {
        if (imageInput.files.length === 0) return;

        const file = imageInput.files.item(0);
        imageInput.value = "";

        const url = URL.createObjectURL(file);

        loadImage(url).then((image) => {
            setLoadedImage(image);

            requestRedraw();
        }).finally(() => {
            URL.revokeObjectURL(url);
        });
    });

    /**
     * @type {HTMLSelectElement}
     */
    const pointSelect = document.getElementById("select-point");
    pointSelect.addEventListener("change", () => {
        const newSelectedPoint = pointSelect.selectedIndex !== 0 ? pointSelect.selectedIndex - 1 : null;
        if (newSelectedPoint === state.selectedPoint) return;

        if (selectLine(null)) {
            selectPoint(newSelectedPoint);
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

        movePointWorld(state.selectedPoint, ...values);

        requestRedraw();
    });

    /**
     * @type {HTMLInputElement}
     */
    const worldPosCopyInput = document.getElementById("input-world-pos-copy");
    worldPosCopyInput.addEventListener("click", (event) => {
        if (state.selectedPoint === null) return;

        const point = state.points[state.selectedPoint];

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

        movePointProjected(state.selectedPoint, ...values);
    });

    /**
     * @type {HTMLInputElement}
     */
    const projectedPosCopyInput = document.getElementById("input-projected-pos-copy");
    projectedPosCopyInput.addEventListener("click", (event) => {
        if (state.selectedPoint === null) return;

        const point = state.points[state.selectedPoint];

        navigator.clipboard.writeText(`${point.px} ${point.py}`);
    });

    /**
     * @type {HTMLSelectElement}
     */
    const lineSelect = document.getElementById("select-line");
    lineSelect.addEventListener("change", () => {
        const newSelectedLine = lineSelect.selectedIndex !== 0 ? lineSelect.selectedIndex - 1 : null;

        if (selectLine(newSelectedLine)) {
            selectPoint(null);
        }

        requestRedraw();
    });

    /**
     * @type {HTMLCanvasElement}
     */
    const canvas = document.getElementById("canvas");
    const context = canvas.getContext("2d");

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
        if (loadedImage === null) return;

        const worldPoints = state.points.map((point) => {
            return [ point.wx, point.wy, point.wz ];
        });
        const projectedPoints = state.points.map((point) => {
            return [ point.px, point.py ];
        });

        const constants = [
            state.offsetBy01,
            loadedImage.width,
            loadedImage.height,
        ];
        const startingVariables = [
            state.cameraX,
            state.cameraY,
            state.cameraZ,
            state.cameraYaw * (Math.PI / 180),
            state.cameraPitch * (Math.PI / 180),
            state.cameraFov * (Math.PI / 180),
        ];
        const maxSteps = [
            state.cameraXLocked ? 0 : 1,
            state.cameraYLocked ? 0 : 1,
            state.cameraZLocked ? 0 : 1,
            state.cameraYawLocked ? 0 : (Math.PI / 180),
            state.cameraPitchLocked ? 0 : (Math.PI / 180),
            state.cameraFovLocked ? 0 : (Math.PI / 180),
        ];
        const newVariables = reverseProjection(constants, startingVariables, maxSteps, worldPoints, projectedPoints, state.iterations);
        if (!state.cameraXLocked) state.cameraX = newVariables[0];
        if (!state.cameraYLocked) state.cameraY = newVariables[1];
        if (!state.cameraZLocked) state.cameraZ = newVariables[2];
        if (!state.cameraYawLocked) state.cameraYaw = newVariables[3] / (Math.PI / 180);
        if (!state.cameraPitchLocked) state.cameraPitch = newVariables[4] / (Math.PI / 180);
        if (!state.cameraFovLocked) state.cameraFov = newVariables[5] / (Math.PI / 180);

        requestRedraw();
    });

    /**
     * @type {HTMLTextAreaElement}
     */
    const stateTextarea = document.getElementById("textarea-state");
    stateTextarea.readOnly = true;
    stateTextarea.addEventListener("paste", (event) => {
        const newState = JSON.parse(event.clipboardData.getData("text"));

        for (const key in state) {
            if (typeof newState[key] === "undefined") {
                return;
            }
        }

        state = newState;

        linesData = Array(state.lines.length).fill(null);
        for (let i = 0; i < state.lines.length; i++) {
            updateLineData(i);
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

    let centerX = 0;
    let centerY = 0;
    let zoomIndex = 0;
    let zoom = 1;
    let prevMouseDownPos = null;
    let prevMouseUpPos = null;
    let mouseDragging = false;
    let draggedPointIndex = null;
    let draggedPointOffsetX = 0;
    let draggedPointOffsetY = 0;
    let doubleClickStartTime = 0;

    canvas.tabIndex = -1;

    canvas.addEventListener("mousedown", (event) => {
        if (loadedImage === null) return;
        
        event.preventDefault();
        
        canvas.focus();

        if (prevMouseDownPos !== null) return;

        if (!event.shiftKey && Date.now() - doubleClickStartTime <= CONFIG.doubleClickDelay && prevMouseUpPos !== null) {
            const dx = event.offsetX - prevMouseUpPos.x;
            const dy = event.offsetY - prevMouseUpPos.y;
            const dsq = dx * dx + dy * dy;
            if (dsq <= CONFIG.mouseDragMin * CONFIG.mouseDragMin) {
                const px = roundTo(roundTo((event.offsetX - canvas.clientWidth / 2) / zoom + centerX, zoom), 1000);
                const py = roundTo(roundTo((event.offsetY - canvas.clientHeight / 2) / zoom + centerY, zoom), 1000);

                let wx = 0;
                let wy = 0;
                let wz = 0;
                if (state.selectedPointHistory.length !== 0) {
                    const point = state.points[state.selectedPointHistory[state.selectedPointHistory.length - 1]];
                    wx = point.wx;
                    wy = point.wy;
                    wz = point.wz;
                }

                if (selectLine(null)) {
                    selectPoint(createPoint(wx, wy, wz, px, py));

                    requestRedraw();
                }
            }
        }

        draggedPointIndex = null;

        let minDsq = Number.MAX_VALUE;

        for (let i = 0; i < state.points.length; i++) {
            if (!(i === state.selectedPoint || state.selectedLine !== null && state.lines[state.selectedLine].points.includes(i))) continue;

            const px = (event.offsetX - canvas.clientWidth / 2) / zoom + centerX;
            const py = (event.offsetY - canvas.clientHeight / 2) / zoom + centerY;

            const point = state.points[i];

            const dx = (point.px - px) * zoom;
            const dy = (point.py - py) * zoom;
            const dsq = dx * dx + dy * dy;

            if (dsq < CONFIG.pointOuterRadius * CONFIG.pointOuterRadius && dsq < minDsq) {
                minDsq = dsq;
                draggedPointIndex = i;
                draggedPointOffsetX = dx;
                draggedPointOffsetY = dy;
            }
        }

        prevMouseDownPos = {
            x: event.offsetX,
            y: event.offsetY,
        };
        doubleClickStartTime = Date.now();
    });

    window.addEventListener("mouseup", (event) => {
        if (loadedImage === null) return;
        
        if (prevMouseDownPos === null) return;

        if (!mouseDragging) {
            const px = (event.offsetX - canvas.clientWidth / 2) / zoom + centerX;
            const py = (event.offsetY - canvas.clientHeight / 2) / zoom + centerY;

            let minPointDistSq = Number.MAX_VALUE;
            let clickedPointIndex = null;
            
            for (let i = 0; i < state.points.length; i++) {
                const point = state.points[i];
                const radius = state.selectedPoint === i ? CONFIG.pointOuterRadius : state.selectedLine !== null && state.lines[state.selectedLine].points.includes(i) ? CONFIG.pointOuterRadius - (CONFIG.pointOuterRadius - CONFIG.pointInnerRadius) / 2 : CONFIG.pointInnerRadius + CONFIG.pointEdgeWidth;

                const dx = (point.px - px) * zoom;
                const dy = (point.py - py) * zoom;
                const dsq = dx * dx + dy * dy;
                
                if (dsq <= radius * radius && dsq < minPointDistSq) {
                    minPointDistSq = dsq;
                    clickedPointIndex = i;
                }
            }

            if (clickedPointIndex !== null) {
                if (event.shiftKey) {
                    selectPoint(null);

                    if (state.selectedLine === null) {
                        selectLine(createLine());
                    }

                    toggleLinePoint(state.selectedLine, clickedPointIndex);
                } else {
                    if (selectLine(null)) {
                        selectPoint(clickedPointIndex);
                    }
                }
            } else {
                let minLineDist = Number.MAX_VALUE;
                let clickedLineIndex = null;

                for (let i = 0; i < state.lines.length; i++) {
                    const abc = calculateBestLineABCNorm(i);
                    if (abc === null) continue;

                    const lineDist = Math.abs(abc.a * px + abc.b * py + abc.c);
                    if (lineDist < 5 / zoom && lineDist < minLineDist) {
                        minLineDist = lineDist;
                        clickedLineIndex = i;
                    }
                }

                if (clickedLineIndex !== null && !event.shiftKey) {
                    if (selectLine(clickedLineIndex)) {
                        selectPoint(null);
                    }
                } else {
                    if (event.shiftKey) {
                        const pixelPx = Math.floor((event.offsetX - canvas.clientWidth / 2) / zoom + roundPx(centerX));
                        const pixelPy = Math.floor((event.offsetY - canvas.clientHeight / 2) / zoom + roundPx(centerY));
        
                        selectPoint(null);

                        if (state.selectedLine === null) {
                            selectLine(createLine());
                        }

                        toggleLinePixel(state.selectedLine, pixelPx, pixelPy);
                    } else {
                        selectPoint(null);
                        selectLine(null);
                    }
                }
            }

            requestRedraw();
        }

        prevMouseDownPos = null;
        prevMouseUpPos = {
            x: event.offsetX,
            y: event.offsetY,
        };
        mouseDragging = false;
        draggedPointIndex = null;
    });

    canvas.addEventListener("mousemove", (event) => {
        if (loadedImage === null) return;

        event.preventDefault();

        if (!mouseDragging && prevMouseDownPos !== null) {
            const dx = event.offsetX - prevMouseDownPos.x;
            const dy = event.offsetY - prevMouseDownPos.y;
            const dsq = dx * dx + dy * dy;

            if (dsq > CONFIG.mouseDragMin * CONFIG.mouseDragMin) {
                mouseDragging = true;
                doubleClickStartTime = 0;
            }
        }

        if (mouseDragging) {
            const dx = event.offsetX - prevMouseDownPos.x;
            const dy = event.offsetY - prevMouseDownPos.y;

            if (draggedPointIndex !== null) {
                const px = roundTo(roundTo((event.offsetX + draggedPointOffsetX - canvas.clientWidth / 2) / zoom + centerX, zoom), 1000);
                const py = roundTo(roundTo((event.offsetY + draggedPointOffsetY - canvas.clientHeight / 2) / zoom + centerY, zoom), 1000);

                movePointProjected(draggedPointIndex, px, py);
            } else {
                centerX -= dx / zoom;
                centerY -= dy / zoom;
            }
            
            prevMouseDownPos = {
                x: event.offsetX,
                y: event.offsetY,
            };

            requestRedraw();
        }
    });

    canvas.addEventListener("wheel", (event) => {
        if (loadedImage === null) return;
        
        event.preventDefault();

        const prevZoom = zoom;
        zoomIndex = Math.min(Math.max(zoomIndex + Math.round(-event.deltaY / 100) * CONFIG.zoomIndexStep, CONFIG.zoomIndexMin), CONFIG.zoomIndexMax);
        zoom = Math.pow(2, zoomIndex);
        centerX += (event.offsetX - canvas.clientWidth / 2) * (1 / prevZoom - 1 / zoom);
        centerY += (event.offsetY - canvas.clientHeight / 2) * (1 / prevZoom - 1 / zoom);
        if (mouseDragging && draggedPointIndex !== null) {
            const px = roundTo(roundTo((event.offsetX + draggedPointOffsetX - canvas.clientWidth / 2) / zoom + centerX, zoom), 1000);
            const py = roundTo(roundTo((event.offsetY + draggedPointOffsetY - canvas.clientHeight / 2) / zoom + centerY, zoom), 1000);

            movePointProjected(draggedPointIndex, px, py);
        }
        
        requestRedraw();
    });

    canvas.addEventListener("keydown", (event) => {
        if (loadedImage !== null)  {
            if (state.selectedPoint !== null || state.selectedLine !== null) {
                if (event.key === "Backspace" || event.key === "Delete") {
                    event.preventDefault();
    
                    if (state.selectedPoint !== null) {
                        removePoint(state.selectedPoint);
                    } else {
                        removeLine(state.selectedLine);
                    }
    
                    requestRedraw();
                }
            }

            if (state.selectedPoint !== null) {
                for (const [key, dsx, dsy] of [["ArrowDown", 0, 1], ["ArrowUp", 0, -1], ["ArrowRight", 1, 0], ["ArrowLeft", -1, 0]]) {
                    if (event.key === key) {
                        event.preventDefault();
    
                        const point = state.points[state.selectedPoint];
    
                        const px = roundTo(roundTo(point.px + dsx / zoom, zoom), 1000);
                        const py = roundTo(roundTo(point.py + dsy / zoom, zoom), 1000);
    
                        movePointProjected(state.selectedPoint, px, py);
    
                        requestRedraw();
                    }
                }
            }
        }
    });

    window.addEventListener("keydown", (event) => {
        if (loadedImage !== null && state.selectedPoint !== null) {
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

    function roundPx(px) {
        return Math.round(px * zoom) / zoom;
    }

    function floorPx(px) {
        return Math.floor(px * zoom) / zoom;
    }

    function ceilPx(px) {
        return Math.ceil(px * zoom) / zoom;
    }

    function requestRedraw() {
        window.requestAnimationFrame(redraw);

        const imageLoaded = loadedImage !== null;
        pointSelect.disabled = !imageLoaded;
        while (pointSelect.length < state.points.length + 1) {
            const option = document.createElement("option");
            option.innerText = `${pointSelect.length - 1}`;
            pointSelect.add(option);
        }
        while (pointSelect.length > state.points.length + 1) {
            pointSelect.remove(pointSelect.length - 1);
        }
        pointSelect.selectedIndex = imageLoaded ? (state.selectedPoint !== null ? state.selectedPoint + 1 : 0) : 0;

        const pointSelected = imageLoaded && state.selectedPoint !== null;
        worldPosXInput.disabled = !pointSelected;
        worldPosXInput.value = pointSelected ? state.points[state.selectedPoint].wx : "";
        worldPosYInput.disabled = !pointSelected;
        worldPosYInput.value = pointSelected ? state.points[state.selectedPoint].wy : "";
        worldPosZInput.disabled = !pointSelected;
        worldPosZInput.value = pointSelected ? state.points[state.selectedPoint].wz : "";

        worldPosCopyInput.disabled = !pointSelected;

        projectedPosXInput.disabled = !pointSelected;
        projectedPosXInput.value = pointSelected ? state.points[state.selectedPoint].px : "";
        projectedPosYInput.disabled = !pointSelected;
        projectedPosYInput.value = pointSelected ? state.points[state.selectedPoint].py : "";

        projectedPosCopyInput.disabled = !pointSelected;

        lineSelect.disabled = !imageLoaded;
        while (lineSelect.length < state.lines.length + 1) {
            const option = document.createElement("option");
            option.innerText = `${lineSelect.length - 1}`;
            lineSelect.add(option);
        }
        while (lineSelect.length > state.lines.length + 1) {
            lineSelect.remove(lineSelect.length - 1);
        }
        lineSelect.selectedIndex = imageLoaded ? (state.selectedLine !== null ? state.selectedLine + 1 : 0) : 0;

        showGridInput.checked = state.showGrid;
        showBlurInput.checked = state.showBlur;
        showProjectedInput.checked = state.showProjected;
        offsetBy01Input.checked = state.offsetBy01;

        cameraPosXInput.value = state.cameraX;
        cameraPosYInput.value = state.cameraY;
        cameraPosZInput.value = state.cameraZ;
        cameraRotYawInput.value = state.cameraYaw;
        cameraRotPitchInput.value = state.cameraPitch;
        cameraFovInput.value = state.cameraFov;

        cameraPosXLockedInput.checked = state.cameraXLocked;
        cameraPosYLockedInput.checked = state.cameraYLocked;
        cameraPosZLockedInput.checked = state.cameraZLocked;
        cameraRotYawLockedInput.checked = state.cameraYawLocked;
        cameraRotPitchLockedInput.checked = state.cameraPitchLocked;
        cameraFovLockedInput.checked = state.cameraFovLocked;

        iterationsInput.value = state.iterations;

        stateTextarea.innerText = JSON.stringify(state);

        // axis1IndexSelect.selectedIndex = axis1[0];
        // axis1RangeInput.value = axis1[1];
        // axis2IndexSelect.selectedIndex = axis2[0];
        // axis2RangeInput.value = axis2[1];

        // maxErrorInput.value = maxError;
    }

    function redraw() {
        canvas.width = canvas.clientWidth;
        canvas.height = canvas.clientHeight;

        context.setTransform(1, 0, 0, 1, 0, 0);
        context.clearRect(0, 0, canvas.width, canvas.height);

        if (loadedImage === null) return;
        
        context.translate(canvas.width / 2, canvas.height / 2);
        context.scale(zoom, zoom);
        context.translate(-roundPx(centerX), -roundPx(centerY));

        context.imageSmoothingEnabled = state.showBlur;
        context.drawImage(loadedImage, 0, 0, loadedImage.width, loadedImage.height);

        if (state.showGrid && zoom >= 8) {
            const minX = Math.max(Math.floor(floorPx(centerX - canvas.width / 2 / zoom)), 0);
            const maxX = Math.min(Math.ceil(ceilPx(centerX + canvas.width / 2 / zoom)), loadedImage.width);
            const minY = Math.max(Math.floor(floorPx(centerY - canvas.height / 2 / zoom)), 0);
            const maxY = Math.min(Math.ceil(ceilPx(centerY + canvas.height / 2 / zoom)), loadedImage.height);

            context.beginPath();

            for (let x = minX; x <= maxX; x++) {
                context.moveTo(x, minY);
                context.lineTo(x, maxY);
            }

            for (let y = minY; y <= maxY; y++) {
                context.moveTo(minX, y);
                context.lineTo(maxX, y);
            }

            context.lineWidth = 1 / zoom;
            context.strokeStyle = "#aaa";
            context.setLineDash([1 / zoom])
            context.stroke();
        }
        context.setLineDash([]);
        
        function drawPoint(centerPath, outlinePath, smallOutlinePath, outlineEdgePath, px, py, selected, small) {
            centerPath.addPath((() => {
                const path = new Path2D();
                path.arc(px, py, 1 / zoom, 0, 2 * Math.PI);
                return path;
            })());

            if (selected) {
                const outerRadius = !small ? CONFIG.pointOuterRadius : CONFIG.pointOuterRadius - (CONFIG.pointOuterRadius - CONFIG.pointInnerRadius - CONFIG.pointEdgeWidth * 2) * 0.5;

                (small ? smallOutlinePath : outlinePath).addPath((() => {
                    const path = new Path2D();
                    path.arc(px, py, (CONFIG.pointInnerRadius + outerRadius) * 0.5 / zoom, 0, 2 * Math.PI);
                    return path;
                })());
                
                outlineEdgePath.addPath((() => {
                    const path = new Path2D();
                    path.arc(px, py, (CONFIG.pointInnerRadius + CONFIG.pointEdgeWidth * 0.5) / zoom, 0, 2 * Math.PI);
                    return path;
                })());
                
                outlineEdgePath.addPath((() => {
                    const path = new Path2D();
                    path.arc(px, py, (outerRadius - CONFIG.pointEdgeWidth * 0.5) / zoom, 0, 2 * Math.PI);
                    return path;
                })());
            } else {
                outlineEdgePath.addPath((() => {
                    const path = new Path2D();
                    path.arc(px, py, (CONFIG.pointInnerRadius + CONFIG.pointEdgeWidth * 0.5) / zoom, 0, 2 * Math.PI);
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

        for (let i = 0; i < state.points.length; i++) {
            const selected = state.selectedPoint === i || state.selectedLine !== null && state.lines[state.selectedLine].points.includes(i);
            const small = selected && state.selectedPoint !== i;
            
            const point = state.points[i];
            drawPoint(centerPath, outlinePath, smallOutlinePath, outlineEdgePath, point.px, point.py, selected, small);

            if (state.showProjected) {
                const [ ppx, ppy ] = project([ state.offsetBy01, loadedImage.width, loadedImage.height ], [ state.cameraX, state.cameraY, state.cameraZ, state.cameraYaw * (Math.PI / 180), state.cameraPitch * (Math.PI / 180), state.cameraFov * (Math.PI / 180) ], [ point.wx, point.wy, point.wz ]);
                drawPoint(projectedCenterPath, projectedOutlinePath, projectedSmallOutlinePath, outlineEdgePath, ppx, ppy, selected, small);
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

        for (let i = 0; i < state.lines.length; i++) {
            const line = state.lines[i];
            const lineData = linesData[i];

            const abc = calculateBestLineABCNorm(i);
            if (abc !== null) {
                const { a, b, c } = abc;

                let x1, y1, x2, y2;

                // line is mostly horizontal
                if (a * a < loadedImage.width / loadedImage.height) {
                    x1 = 0;
                    y1 = -(a * x1 + c) / b;
                    if (y1 < 0) {
                        y1 = 0;
                        x1 = -(b * y1 + c) / a;
                    } else if (y1 > loadedImage.height) {
                        y1 = loadedImage.height;
                        x1 = -(b * y1 + c) / a;
                    }
                    x2 = loadedImage.width;
                    y2 = -(a * x2 + c) / b;
                    if (y2 < 0) {
                        y2 = 0;
                        x2 = -(b * y2 + c) / a;
                    } else if (y2 > loadedImage.height) {
                        y2 = loadedImage.height;
                        x2 = -(b * y2 + c) / a;
                    }
                } else {
                    y1 = 0;
                    x1 = -(b * y1 + c) / a;
                    if (x1 < 0) {
                        x1 = 0;
                        y1 = -(a * x1 + c) / b;
                    } else if (x1 > loadedImage.width) {
                        x1 = loadedImage.width;
                        y1 = -(a * x1 + c) / b;
                    }
                    y2 = loadedImage.height;
                    x2 = -(b * y2 + c) / a;
                    if (x2 < 0) {
                        x2 = 0;
                        y2 = -(a * x2 + c) / b;
                    } else if (x2 > loadedImage.width) {
                        x2 = loadedImage.width;
                        y2 = -(a * x2 + c) / b;
                    }
                }

                const path = i === state.selectedLine ? selectedLineCenterPath : lineCenterPath;
                path.moveTo(x1, y1);
                path.lineTo(x2, y2);
            }
            
            if (i === state.selectedLine) {
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
        
        context.lineWidth = 1 / zoom;
        context.strokeStyle = "#00fb";
        context.stroke(lineSplitPath);
        
        context.lineWidth = 1 / zoom;
        context.strokeStyle = "#f00b";
        context.stroke(pixelEmptyPath);
        
        context.lineWidth = 1 / zoom;
        context.strokeStyle = "#0f0b";
        context.stroke(pixelFilledPath);
        
        context.lineWidth = 1 / zoom;
        context.strokeStyle = "#f904";
        context.stroke(lineCenterPath);
        
        context.lineWidth = 1 / zoom;
        context.strokeStyle = "#f90b";
        context.stroke(selectedLineCenterPath);
        
        context.lineWidth = CONFIG.pointEdgeWidth / zoom;
        context.strokeStyle = "#222b";
        context.stroke(outlineEdgePath);

        if (state.showProjected) {
            context.fillStyle = "#00f";
            context.fill(projectedCenterPath);

            context.lineWidth = (CONFIG.pointOuterRadius - CONFIG.pointInnerRadius - CONFIG.pointEdgeWidth * 2) / zoom;
            context.strokeStyle = "#0afb";
            context.stroke(projectedOutlinePath);

            context.lineWidth = (CONFIG.pointOuterRadius - CONFIG.pointInnerRadius - CONFIG.pointEdgeWidth * 2) * 0.5 / zoom;
            context.strokeStyle = "#0afb";
            context.stroke(projectedSmallOutlinePath);
        }

        context.fillStyle = "#f00";
        context.fill(centerPath);

        context.lineWidth = (CONFIG.pointOuterRadius - CONFIG.pointInnerRadius - CONFIG.pointEdgeWidth * 2) / zoom;
        context.strokeStyle = "#0f0b";
        context.stroke(outlinePath);

        context.lineWidth = (CONFIG.pointOuterRadius - CONFIG.pointInnerRadius - CONFIG.pointEdgeWidth * 2) * 0.5 / zoom;
        context.strokeStyle = "#0f0b";
        context.stroke(smallOutlinePath);

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