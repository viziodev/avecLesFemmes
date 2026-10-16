/** Success effects must only run after the server has acknowledged the mutation. */
export async function confirmedAction(
  task: () => Promise<unknown>,
  onSuccess: () => void,
  onError: (error: unknown) => void,
): Promise<boolean> {
  try {
    await task();
  } catch (error) {
    onError(error);
    return false;
  }
  onSuccess();
  return true;
}
