/** Base abstraction for a system/Actor-type adapter. */
export class CharacterAdapter {
  supports(_actor) {
    return false;
  }

  async convert(_actor) {
    throw new Error("CharacterAdapter.convert must be implemented by a concrete adapter");
  }
}
