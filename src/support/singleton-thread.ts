export class SingletonThread {
    body: () => Promise<void>;
    running = false;
    constructor(body: () => Promise<void>) {
        this.body = body;
    }
    async run() {
        if (this.running) {
            return;
        }
        try {
            this.running = true;
            await this.body();
        } finally {
            this.running = false;
        }
    }
}
