import { ExecJSONControl as ResultControl_1_0 } from "./generated_parsers/exec-json";
import { ProfileJSONControl as ProfileControl_1_0 } from "./generated_parsers/profile-json";
import { ProfileControl as HDFProfileControl_1_0, ExecControl as HDFExecControl_1_0 } from "./compat_impl/compat_inspec_1_0";
import * as parsetypes from "./fileparse";
import { setFlagsFromString } from "v8";

// These types are used throughout for control/result status and impact

/**
 * The statuses that a control might have.
 *
 * This is computed as follows:
 * If it came from a profile view output (thus was not run), it is "From Profile"
 * Else, if it has no statuses (implying no describe blocks), it is "No Data"
 * Else, if it has 0 impact, it is "Not Applicable"
 * Else, if it contains an "error" amidst its status list, it is "Profile Error"
 * Else, if it contains a "failed" amidst its status list, it is "Failed"
 * Else, if it contains a "passed" amidst its status list, it is "Passed"
 * Else, if it contains a "skipped" amidst its status list, it is "Not Reviewed". 
 * Note that the "Not Reviewed" case implicitly means ALL of its statuses are "skipped"
 * These cases are in theory comprehensive, but if somehow no apply, it is still Profile Error
 */
export type ControlStatus =
    "Not Applicable"
    | "From Profile"    
    | "No Data"         
    | "Profile Error"
    | "Passed"
    | "Failed"
    | "Not Reviewed";

/** The severities a control can have. These map numeric impact values to No/Low/Medium/High/Crtiical impact
 * [0, 0.01) => No impact
 * [0.01, 0.4) => Low impact
 * [0.4, 0.7) => Medium impact
 * [0.7, 0.9) => High impact
 * [0.9, 1.0] => Critical impact
 */
export type Severity = "none" | "low" | "medium" | "high" | "critical";

/** The statuses that a PART of a control (IE a describe block) might have. */
export type ResultStatus = "passed" | "failed" | "skipped" | "error";

/**
 * This interface acts as a polyfill on controls for our HDF "guaranteed" derived types, to provide a stable
 * method for acessing their properties across different schemas.
 */
export interface HDFControl {
    /**
     * The control that this interface wraps
     */
    wraps: parsetypes.AnyFullControl;

    /**
     * Get the control status as computed for the entire control.
     */
    status: ControlStatus;

    /**
     * TODO: Document whatever the hell this actually is
     */
    vuln_num: string;

    severity: Severity;

    /**
     * A string that essentially acts as a user-facing log of the results of the success/failure of each
     * part of the control's code.
     * This variable is UNSTABLE and should not be used as a ground-truth for testing, as it's format may be changed
     * in the future.
     */
    message: string;

    // May be present depending on type of input
    /**
     * Returns the nist tags if they exist.
     * If none exist, returns "UM-1"
     */
    nist_tags: string[];

    /**
     * Returns a user-facing representation of the result of this status, consisting of a message explaining
     * this controls status, followed by the contents of this.message.
     */
    finding_details: string;

    /**
     * Returns the nist tags with any extraneous/duplicate data (Rev4, (b), etc.) removed,
     * sorted alphabetically
     */
    fixed_nist_tags: string[];

    /** Get the start time of this control's run, as determiend by the time of the first test.
     * If no tests were run, (it is a profile-json or has no tests) returns undefined
     */
    start_time?: string;

    /** Get the results of this control's `describe` blocks as a list.
     * If no tests were run, (it is a profile-json or has no tests) returns undefined
     */
    status_list?: ResultStatus[];
}

/**
 * Wrapper to guarantee HDF properties on a control
 *
 * TODO: Figure out if/how we want to error out when a polyfill is impossible
 * @param ctrl The control to polyfill
 */
export function hdfWrapControl(ctrl: parsetypes.AnyFullControl): HDFControl {
    // Determine which schema it is
    if ((ctrl as ResultControl_1_0).results !== undefined) {
        let rctrl = ctrl as ResultControl_1_0;
        return new HDFExecControl_1_0(rctrl);
    } else {
        let rctrl = ctrl as ProfileControl_1_0;
        return new HDFProfileControl_1_0(rctrl);
    }

    // In theory future schemas will be easier to decipher because of a version tag
    throw "Error: Control did not match any expected schema";
}