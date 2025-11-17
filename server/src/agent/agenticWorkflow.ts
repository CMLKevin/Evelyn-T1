/**
 * AgenticWorkflowEngine
 * ----------------------
 *
 * This is a lightweight placeholder implementation used to satisfy imports
 * from the orchestrator while the full agentic workflow feature is being
 * iterated on. The orchestrator currently only constructs the engine; it
 * does not yet call any of its methods directly, so we keep this minimal
 * and non-invasive.
 *
 * The design goal here is:
 * - Avoid runtime module-not-found errors when starting the dev server
 * - Provide a clear extension point for future agentic workflow logic
 * - Keep the implementation side‑effect free beyond basic logging
 */

export class AgenticWorkflowEngine {
  private db: any;
  private io: any;

  constructor(db: any, io: any) {
    this.db = db;
    this.io = io;

    // Basic initialization log so we can confirm wiring in dev logs
    console.log('[AgenticWorkflow] Engine initialized');
  }

  /**
   * Placeholder no-op hook. In the future this can coordinate multi-step
   * workflows (planning, tool use, code changes, etc.). For now we keep it
   * intentionally empty so it has zero behavioral impact.
   */
  async handleEvent(_event: string, _payload: unknown): Promise<void> {
    // Intentionally left blank for now
  }
}
