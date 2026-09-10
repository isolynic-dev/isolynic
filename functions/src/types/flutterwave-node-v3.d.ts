declare module 'flutterwave-node-v3' {
  interface FlutterwaveSubscription {
    cancel(options: { id: string | number }): Promise<unknown>;
  }

  class Flutterwave {
    Subscription: FlutterwaveSubscription;

    constructor(publicKey: string, secretKey: string);
  }

  export default Flutterwave;
}