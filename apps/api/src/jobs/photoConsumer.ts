export async function processPhotos(batch: MessageBatch, env: unknown) {
  for (const msg of batch.messages) {
    // TODO: R2-object lezen → EXIF/GPS strippen → thumbnail → photo_status = 'ready'
    msg.ack();
  }
}
