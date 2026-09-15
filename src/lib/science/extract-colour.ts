/**
 * Samples the centre of the frame, where the user is instructed to aim at
 * open water, avoiding banks and sky at the edges.
 */
export function extractCentreRegion(
  image: ImageData,
  fraction = 0.5,
): Uint8ClampedArray {
  const cropWidth = Math.max(1, Math.floor(image.width * fraction));
  const cropHeight = Math.max(1, Math.floor(image.height * fraction));
  const startX = Math.floor((image.width - cropWidth) / 2);
  const startY = Math.floor((image.height - cropHeight) / 2);

  const output = new Uint8ClampedArray(cropWidth * cropHeight * 4);
  let cursor = 0;

  for (let y = startY; y < startY + cropHeight; y++) {
    for (let x = startX; x < startX + cropWidth; x++) {
      const source = (y * image.width + x) * 4;
      output[cursor++] = image.data[source];
      output[cursor++] = image.data[source + 1];
      output[cursor++] = image.data[source + 2];
      output[cursor++] = image.data[source + 3];
    }
  }

  return output;
}
