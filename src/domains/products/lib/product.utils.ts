export function getPrimaryImage(
  images: Array<{ url: string; isPrimary?: boolean | null }>
): string | undefined {
  return images.find((img) => img.isPrimary)?.url ?? images[0]?.url
}
