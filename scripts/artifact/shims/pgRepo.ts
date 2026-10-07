export class PgRepo {
  constructor() {
    throw new Error("Postgres is not available in the artifact build.");
  }
}
