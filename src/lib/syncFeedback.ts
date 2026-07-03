/** True when every cloud write in a flow succeeded (guest flows pass with no args). */
export function allCloudSynced(...results: boolean[]): boolean {
  return results.every(Boolean);
}
