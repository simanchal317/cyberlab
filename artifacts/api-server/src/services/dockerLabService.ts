export type DockerLabConfig = {
  image: string | null;
  tag: string | null;
  targetPort: number | null;
  protocol: string;
  network?: string | null;
  timeoutMinutes: number;
  configured: boolean;
};

export type DockerLabResult =
  | { ok: true; containerReference: string }
  | { ok: false; code: "DOCKER_NOT_CONFIGURED"; message: string };

/**
 * Adapter boundary for the external Docker host.
 *
 * This intentionally does not shell out to Docker or expose a Docker socket.
 * A later deployment can replace this adapter with a remote Docker service
 * without changing the lab or HTTP layers.
 */
export class DockerLabService {
  private readonly configured = Boolean(process.env.DOCKER_HOST);

  async createLabInstance(_config: DockerLabConfig): Promise<DockerLabResult> {
    if (!this.configured) {
      return {
        ok: false,
        code: "DOCKER_NOT_CONFIGURED",
        message:
          "Docker integration unavailable. Configure an external Docker host before starting labs.",
      };
    }

    return {
      ok: false,
      code: "DOCKER_NOT_CONFIGURED",
      message:
        "A Docker host is configured, but the external lab adapter has not been installed yet.",
    };
  }

  async startLabInstance(_containerReference: string): Promise<DockerLabResult> {
    return this.unavailable();
  }

  async stopLabInstance(_containerReference: string): Promise<DockerLabResult> {
    return this.unavailable();
  }

  async restartLabInstance(_containerReference: string): Promise<DockerLabResult> {
    return this.unavailable();
  }

  async getLabInstanceStatus(_containerReference: string): Promise<DockerLabResult> {
    return this.unavailable();
  }

  async removeLabInstance(_containerReference: string): Promise<DockerLabResult> {
    return this.unavailable();
  }

  private unavailable(): DockerLabResult {
    return {
      ok: false,
      code: "DOCKER_NOT_CONFIGURED",
      message: "The external Docker lab adapter is not available.",
    };
  }
}

export const dockerLabService = new DockerLabService();