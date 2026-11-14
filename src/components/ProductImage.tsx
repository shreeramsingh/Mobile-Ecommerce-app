import React, { useState } from 'react';
import { Image, type ImageProps, type ImageStyle, type StyleProp } from 'react-native';

export const PLACEHOLDER = require('../assets/images/placeholder.jpeg');

/** Remote image that falls back to the Bandookwale logo when missing or broken. */
export function ProductImage({
  uri,
  style,
  resizeMode = 'cover',
  ...rest
}: Omit<ImageProps, 'source'> & { uri?: string | null; style?: StyleProp<ImageStyle> }) {
  const [failed, setFailed] = useState(false);
  const source = uri && !failed ? { uri } : PLACEHOLDER;
  return (
    <Image
      {...rest}
      source={source}
      style={style}
      resizeMode={resizeMode}
      onError={() => setFailed(true)}
      // Downsample large photos on Android to keep memory low in long lists.
      resizeMethod="resize"
    />
  );
}
