// Geometry for the square photo cropper. The frame is a virtual square of FRAME units, so the
// numbers do not depend on how large the frame is drawn on screen.
//
// A crop is { zoom, x, y }:
// - zoom 1 shows the photo "cover" (it fills the frame, the short side touches the edges);
//   below 1 the whole photo fits ("contain") with an empty margin; MAX_ZOOM is the closest view.
// - x, y are where the photo's top-left corner sits in the frame.
export const FRAME = 1000;
export const MAX_ZOOM = 4;

const size = (width, height) => ({
  width: Math.max(1, width || 1),
  height: Math.max(1, height || 1),
});

/** Zoom at which the whole photo fits inside the frame. 1 for a square photo. */
export function minZoom(width, height) {
  const photo = size(width, height);
  return Math.min(photo.width, photo.height) / Math.max(photo.width, photo.height);
}

/** Frame units per photo pixel at a given zoom. */
const scale = (photo, zoom) => (FRAME / Math.min(photo.width, photo.height)) * zoom;

/** Drawn width and height of the photo, in frame units. */
export function drawnSize(width, height, zoom) {
  const photo = size(width, height);
  return { width: photo.width * scale(photo, zoom), height: photo.height * scale(photo, zoom) };
}

// A photo larger than the frame must cover it (no empty edge); a smaller one must stay inside.
const clampAxis = (position, drawn) =>
  drawn >= FRAME
    ? Math.min(0, Math.max(FRAME - drawn, position))
    : Math.max(0, Math.min(FRAME - drawn, position));

export function clampCrop(crop, width, height) {
  const zoom = Math.min(MAX_ZOOM, Math.max(minZoom(width, height), Number(crop.zoom) || 1));
  const drawn = drawnSize(width, height, zoom);
  return { zoom, x: clampAxis(crop.x, drawn.width), y: clampAxis(crop.y, drawn.height) };
}

/** Centred start: "cover" fills the frame, "contain" shows the whole photo. */
export function initialCrop(width, height, fit = 'cover') {
  const zoom = fit === 'contain' ? minZoom(width, height) : 1;
  const drawn = drawnSize(width, height, zoom);
  return clampCrop(
    { zoom, x: (FRAME - drawn.width) / 2, y: (FRAME - drawn.height) / 2 },
    width,
    height,
  );
}

export function panCrop(crop, dx, dy, width, height) {
  return clampCrop({ ...crop, x: crop.x + dx, y: crop.y + dy }, width, height);
}

/** Zoom while keeping the photo point under (focusX, focusY) in the same place. */
export function zoomCrop(crop, nextZoom, width, height, focusX = FRAME / 2, focusY = FRAME / 2) {
  const limited = clampCrop({ ...crop, zoom: nextZoom }, width, height).zoom;
  const before = drawnSize(width, height, crop.zoom);
  const after = drawnSize(width, height, limited);
  const pointX = (focusX - crop.x) / before.width;
  const pointY = (focusY - crop.y) / before.height;
  return clampCrop(
    { zoom: limited, x: focusX - pointX * after.width, y: focusY - pointY * after.height },
    width,
    height,
  );
}

/**
 * Side of the saved square, in pixels: as many photo pixels as the frame shows, at most
 * `maxSide`, so a zoomed-in crop is not blown up and a large photo is not kept too large.
 */
export function outputSide(crop, width, height, maxSide) {
  const photo = size(width, height);
  const shown = FRAME / scale(photo, crop.zoom);
  return Math.max(1, Math.min(maxSide, Math.round(shown)));
}

/** Where to draw the photo on an output square of `side` pixels. */
export function drawRect(crop, width, height, side) {
  const drawn = drawnSize(width, height, crop.zoom);
  const ratio = side / FRAME;
  return {
    x: crop.x * ratio,
    y: crop.y * ratio,
    width: drawn.width * ratio,
    height: drawn.height * ratio,
  };
}
