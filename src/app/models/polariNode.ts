// Author: Dustin Etts
export class polariNode {
    ip : string;
    port: string;
    crudeAPIs: any[];
    polariAPIs: any[];

    constructor(ip: string, port: string, crudeAPIs: any[], polariAPIs: any[]){
        this.ip = ip;
        this.port = port;
        this.crudeAPIs = crudeAPIs;
        this.polariAPIs = polariAPIs;
    }
}