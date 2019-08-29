/** Implementation for the "base" 1.0 inspec output schema 
 * A lot of information/behaviour is shared between the profile and result version so we use a single abstract superclass
 */

import { ExecJSONControl as ResultControl_1_0 } from "../generated-parsers/exec-json";
import { ProfileJSONControl as ProfileControl_1_0 } from "../generated-parsers/profile-json";
import { ControlResult as ControlResult_1_0 } from "../generated-parsers/exec-json";

import { HDFControl, ControlStatus, Severity, ResultStatus } from "../compat-wrappers";

abstract class HDFControl_1_0 implements HDFControl {
    // We use this as a reference
    wraps: ResultControl_1_0 | ProfileControl_1_0;
    constructor(forControl: ResultControl_1_0 | ProfileControl_1_0) {
        this.wraps = forControl;
    }

    // Helper for turning control results into strings
    static toMessageLine(r: ControlResult_1_0): string {
        switch (r.status) {
            case "skipped":
                return `SKIPPED -- ${r.skip_message}\n`;
            case "failed":
                return `FAILED -- Test: ${r.code_desc}\nMessage: ${
                    r.message
                }\n`;
            case "passed":
                return `PASSED -- ${r.code_desc}\n"`;
            case "error":
                return `ERROR -- Test: ${r.code_desc}\nMessage: ${r.message}`;
            default:
                return `Exception: ${r.exception}\n`;
        }
    }

    // Abstracts
    abstract get message(): string;

    get nist_tags(): string[]  {
        let fetched: string[] | undefined = this.wraps.tags["nist"];
        if(fetched == null || fetched.length === 0) {
            return ["UM-1"];
        } else {
            return fetched;
        }
    }

    get fixed_nist_tags(): string[] {
        const tags = this.nist_tags;

        // Otherwise, filter to only those that follow format @@-#, 
        // where @ is any capital letter, and # is any number (1 or more digits)
        const pattern = /[A-Z][A-Z]-[0-9]+/;
        let results: string[] = [];
        tags.forEach(tag => {
            let finding = tag.match(pattern);
            if(finding !== null && !results.includes(finding[0])) {
                results.push(finding[0]);
            }
        });
        return results;
    }

    /**
     * TODO: Document
     */
    get vuln_num(): string {
        // We truncate the id based up to its first decimal (as far as I can tell - update later)
        if (this.wraps.id.match(/\d+\.\d+/)) {
            let match = this.vuln_num.match(/\d+(\.\d+)*/);
            if (match) {
                return match[0];
            }
        }
        return this.wraps.id;
    }

    get finding_details(): string {
        let result = "";
        switch (this.status) {
            case "Failed":
                return `One or more of the automated tests failed or was inconclusive for the control:\n\n${
                    this.message
                }\n`;
            case "Passed":
                return `All Automated tests passed for the control:\n\n${
                    this.message
                }\n`;
            case "Not Reviewed":
                return `Automated test skipped due to known accepted condition in the control:\n\n${
                    this.message
                }\n`;
            case "Not Applicable":
                return `Justification:\n\n${this.message}\n`;
            case "Profile Error":
                if (this.message) {
                    return `Exception:\n\n${this.message}\n`;
                } else {
                    return `No test available for this control.`;
                }
            case "From Profile":
                return "No tests are run in a profile json."
            case "No Data":
                return "This control had no results - perhaps it was overlayed?"

            default:
                throw "Error: invalid status generated";
        }
    }


    get severity(): Severity {
        if (this.wraps.impact < 0.1) {
            return "none";
        } else if (this.wraps.impact < 0.4) {
            return "low";
        } else if (this.wraps.impact < 0.7) {
            return "medium";
        } else if (this.wraps.impact < 0.9) {
            return "high";
        } else {
            return "critical";
        }
    }

    abstract get status(): ControlStatus;
}

export class ExecControl extends HDFControl_1_0 implements HDFControl {
    constructor(control: ResultControl_1_0) {
        super(control);
    }

    // Helper to cast
    private get typed_wrap(): ResultControl_1_0 {
        return this.wraps as ResultControl_1_0;
    }

    get message(): string {
        if (this.typed_wrap.impact != 0) {
            // If it has any impact, convert each result to a message line and chain them all together
            return this.typed_wrap.results
                .map(HDFControl_1_0.toMessageLine)
                .join("");
        } else {
            // If it's no impact, just post the description (if it exists)
            return this.typed_wrap.desc || "No message found.";
        }
    }

    get start_time(): string | undefined {
        if (this.typed_wrap.results) {
            return this.typed_wrap.results[0].start_time;
        }
        return undefined;
    }

    get status_list(): ResultStatus[] {
        return this.typed_wrap.results.map(cr => {
            if(cr.backtrace !== undefined) {
                return "error";
            } else {
                return cr.status;
            }
        });
    }

    get status(): ControlStatus {
        if (this.status_list.includes("error")) {
            return "Profile Error";
        } else {
            if (this.status_list.length == 0) {
                return "No Data";
            } else if (this.wraps.impact == 0) {
                return "Not Applicable";
            } else if (this.status_list.includes("failed")) {
                return "Failed";
            } else if (this.status_list.includes("passed")) {
                return "Passed";
            } else if (this.status_list.includes("skipped")) {
                return "Not Reviewed";
            } else {
                return "Profile Error";
            }
        }
    }
}

export class ProfileControl extends HDFControl_1_0 implements HDFControl {
    constructor(control: ProfileControl_1_0){
        super(control);
    }

    // Helper to cast
    private get typed_wrap(): ResultControl_1_0 {
        return this.wraps as ResultControl_1_0;
    }

    get message(): string {
        // If it's no impact, just post the description (if it exists)
        return this.typed_wrap.desc || "No message found.";
    }

    get status(): ControlStatus {
        return "From Profile";
    }
}