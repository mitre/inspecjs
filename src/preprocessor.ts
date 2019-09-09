/** 
 * Used to pre-process inspec data. Filters out nulls.
 */
export default function preprocess(text: string): any {
    let obj = JSON.parse(text);
    return recursiveStripNulls(obj);
}

function recursiveStripNulls(obj: any): any {
    if(typeof obj === "object") {
        // Add all subkeys that aren't null
        let result: any = {};
        Object.keys(obj).forEach(key => {
            let sub = recursiveStripNulls(obj[key]);
            if(sub !== null && sub !== undefined) {
                result[key] = sub;
            }
        });
        return result;
    } else {
        // Nothing else to do
        return obj;
    }
}