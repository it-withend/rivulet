"use client";

import { PhotoStep } from "./PhotoStep";

/**
 * Lets a visitor try the on-device colour reading before a stream (and its
 * database row) exists. The result is not sent anywhere.
 */
export function PhotoPreview() {
  return <PhotoStep onResult={() => {}} />;
}
