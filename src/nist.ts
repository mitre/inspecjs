import { ControlStatus, HDFControl } from "./compat_wrappers";
import { ALL_NIST_CONTROL_NUMBERS, ALL_NIST_FAMILIES } from "./raw_nist";

// Regexes. 
const NIST_FAMILY_FORMAT = "[A-Z]{2}";
const SUBSPEC_FORMAT = " |[a-z]\\.|[0-9]+\\.?|\\([a-z]\\)|\\([0-9]+\\)";
const SUBSPEC_FORMAT_RE = RegExp(SUBSPEC_FORMAT);
const NIST_CONTROL_FORMAT = `^(${NIST_FAMILY_FORMAT})(-((${SUBSPEC_FORMAT})*))?`;
const NIST_CONTROL_FORMAT_RE = RegExp(NIST_CONTROL_FORMAT);

/** Represents a single nist control, or group of controls if the sub specs are vague enoug. */
export class NistControl {
    /** The leading two capital letters of the nist control. E.g. CA, RA, etc. */
    family: string;

    /** The sequence of sub-specifiers after the - in the control.
     * E.g.  in "SI-7 (14)(b)", we would have ["7", "(14)", "(b)"]
     *       in "SI-4a.2.", we would have ["4", "a.", "2."];
     * Guaranteed to always be of length at least one.
     * First element is guaranteed to be a number
     */
    sub_specs: string[]; // Guaranteed to be of length at least one on a "real" control

    /** Holds the string from which this control was generated. */
    raw_text?: string;

    /** Trivial constructor */
    constructor(family: string, sub_specs: string[], raw_rext?: string) {
        this.family = family;
        this.sub_specs = sub_specs;
        this.raw_text = raw_rext;
    }

    /** This function checks if the given control is contained by or equivalent to this control.
     * It is purely a wrapper around compare_lineage
    */
    contains(other: NistControl): boolean {
        return this.compare_lineage(other) !== -1;
    }

    /** This function compares this nist control to another nist control.
     * If the other control is the same control as this one, returns 0.
     * 
     * If the other control is a child of this control 
     * (IE it is the same base directives with further enhancements, e.g. `IA-4` -> `IA-4b.` or `AC-9a.` -> `AC-9a. (2)`)
     * and returns how many further enhancements have been applied (IE what is the number of additional subdirectives.)
     * 
     * If the other control is NOT a child of this control, return -1
     */
    compare_lineage(other: NistControl): number {
        // Can't contain if not same family
        if (this.family !== other.family) {
            return -1;
        }
        // Can't contain if we're more specific
        if (this.sub_specs.length > other.sub_specs.length) {
            return -1;
        }

        // After that we just need to iterate
        for (let i = 0; i < this.sub_specs.length; i++) {
            // If our subspec differentiate at any point, then we do not match
            if (this.sub_specs[i] !== other.sub_specs[i]) {
                return -1;
            }
        }

        // We survived! The change in # sub specs is thus the # of changes to enhancements
        return other.sub_specs.length - this.sub_specs.length;
    }

    /** Gives a numeric value indicating how these controls compare, lexicographically.
     * See string.localCompare for the output format.
     */
    localCompare(other: NistControl): number {
        // Convert into a chain of directives
        let a = this;
        let b = other;
        let a_chain = [a.family, ...a.sub_specs];
        let b_chain = [b.family, ...b.sub_specs];
        for (let i = 0; i < a_chain.length && i < b_chain.length; i++) {
            // Compare corresponding elements of the chain
            let a_i = a_chain[i];
            let b_i = b_chain[i];

            // Return only if significant
            let lc = a_i.localeCompare(b_i, "en", { numeric: true });
            if (lc) {
                return lc;
            }
        }

        // Fall back to length comparison. We want shorter first, so ascending's good
        return a_chain.length - b_chain.length;
    }
}

export function parse_nist(raw_nist: string): NistControl | null {
    // Is it just a family?
    // Get the match, failing out if we can't
    let match = raw_nist.match(NIST_CONTROL_FORMAT_RE);
    if (!match) {
        return null;
    }

    // Parse sub-elements
    let family = match[1];
    let subspecs_raw = (match[3] || "").trim();
    let sub_specs: string[] = [];
    // Consume string piecemeal
    while (subspecs_raw) {
        // Should always exist
        let match = subspecs_raw.match(SUBSPEC_FORMAT_RE);
        if (match) {
            // Pull it out
            let next_subspec = match[0];
            // Trim it off
            subspecs_raw = subspecs_raw.slice(next_subspec.length).trim();
            // Push it onto the list
            sub_specs.push(next_subspec);
        } else {
            break;
        }
    }

    return new NistControl(family, sub_specs, raw_nist);
}

/** All a control in a nist hash really needs is a status */
export interface CategoryItemRequirements {
    status: ControlStatus;
}

// Represents the status of a group of controsl. Typically holds the value of the "worst" control amongst the group
// Empty means no controls are in the given group
export type ControlGroupStatus = ControlStatus | "Empty";

/**
 * Computes the groups status having added control.
 * There's a natural precedence to statuses, at least in a list/group
 * For instance, we would not mark a group as Passed if it contained a Failed.
 * Clearly "Empty" is the lowest precedence, as adding any control would wipe it out.
 * Following we have "From Profile" since it is in some way the absence of status, but also lacks run context. We care more about literally anything else
 * Next, "Not Applicable" since it means that though we ran we don't care about the result
 * "Not Reviewed" implies that had the test run it would've mattered, but it was skipped deliberately
 * "No Data" is similarly a lack of result, but in this case unexpected, and thus worthy of more scrutiny
 * "Passed" means that a test passed! But "Failed" should override, since fails are really what we're looking for
 * Finally, "Profile Errors" mean something is broken and needs to be fixed, and thus overrides all
 *
 * Returns:
 * < 0  if a < b (by the above criteria)
 * 0    if a === b
 * > 0  if a > b
 */
export function compare_statuses(a: ControlGroupStatus, b: ControlGroupStatus) {
    const precedence: ControlGroupStatus[] = [
        "Empty",
        "From Profile",
        "Not Applicable",
        "Not Reviewed",
        "Passed",
        "Failed",
        "Profile Error",
    ];
    let a_i = precedence.indexOf(a);
    let b_i = precedence.indexOf(b);
    return a_i - b_i;
}

export function updateStatus(
    group: ControlGroupStatus,
    control: ControlStatus
): ControlGroupStatus {
    if (compare_statuses(group, control) > 0) {
        // Our new control has shifted the status!
        return control;
    } else {
        // Our existing group status was "greater"
        return group;
    }
}

export interface NistHierarchyNode {
    control: NistControl;
    children: NistHierarchyNode[];
}
export type NistHierarchy = NistHierarchyNode[];

function _control_parent(c: NistControl): NistControl | null {
    if (c.sub_specs.length) {
        return new NistControl(
            c.family,
            c.sub_specs.slice(0, c.sub_specs.length - 1)
        );
    } else {
        return null; // Can't get any shorter
    }
}

function _key_for(c: NistControl): string {
    return c.family + c.sub_specs.join("-");
}

function _generate_full_nist_hierarchy(): NistHierarchy {
    // Initialize our roots
    let roots: NistHierarchy = ALL_NIST_FAMILIES.map(family => {
        return {
            control: new NistControl(family, [], family),
            children: [],
        };
    });

    // Init our map, which maps _key_for of controls to their corresponding hierarchy nodes
    let map: { [key: string]: NistHierarchyNode } = {};

    // Add roots to the map
    roots.forEach(r => {
        map[_key_for(r.control)] = r;
    });

    // Iterate over all controls
    ALL_NIST_CONTROL_NUMBERS.forEach(n => {
        let as_control = parse_nist(n);
        if (!as_control) {
            throw `Invalid nist control constant ${n}`;
        }

        // If our node has already been created, replace the temporary control with the "real" one
        let key = _key_for(as_control);
        let as_node: NistHierarchyNode;
        if (map[key]) {
            as_node = map[key];
            as_node.control = as_control;
        } else {
            //Make it fresh
            as_node = {
                control: as_control,
                children: [],
            };

            // Register in map
            map[key] = as_node;
        }

        // Get the parent
        let parent = _control_parent(as_control);

        // If parent is null, add to roots.
        if (!parent) {
            roots.push({
                control: as_control,
                children: [],
            });
        } else {
            // Valid parent; look it up and append us to it
            let parent_key = _key_for(parent);
            let parent_node = map[parent_key];

            // If parent has been explored already, simply append this node to that
            if (parent_node) {
                parent_node.children.push(as_node);
            } else {
                // It's not? make a stub
                map[parent_key] = {
                    control: parent,
                    children: [as_node], // "Us"
                };
            }
        }
    });

    // Now roots are our final answers!
    return roots;
}

export const FULL_NIST_HIERARCHY: Readonly<
    NistHierarchy
> = _generate_full_nist_hierarchy();
