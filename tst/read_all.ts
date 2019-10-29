// Get filesystem
import * as fs from "fs";
import * as path from "path";
import { ConversionResult, convertFile } from "../src/fileparse";

/** Reads the contents of the given files into an array of strings. */
function readFiles(
    dirname: string,
    onFileContent: (filename: string, content: string) => void
) {
    fs.readdir(dirname, function(err, filenames) {
        if (err) {
            console.log(`Error reading dir ${dirname}`);
            console.log(err);
            return;
        }
        filenames.forEach(function(filename) {
            fs.readFile(dirname + filename, "utf-8", function(err, content) {
                if (err) {
                    console.log(`Error reading file ${filename}`);
                    console.log(err);
                    return;
                }
                onFileContent(filename, content);
            });
        });
    });
}

readFiles("tst/examples/profile/", (fn, content) => {
    console.log(`Reading file ${fn}`);

    // Convert it
    let result: ConversionResult;
    try {
        result = convertFile(content);
      } catch (e) {
        return new Error(
          `Failed to convert file ${fn} due to error "${e}".`
        );
      }

    // See if any success
    if(result["1_0_ExecJson"]) {
        console.log(`File ${fn} is an execution`);
    } else if(result["1_0_ExecJsonMin"]) {
        console.log(`File ${fn} is a minimized execution`);
    } else if(result["1_0_ProfileJson"]) {
        console.log(`File ${fn} is a profile.`);
    } else {
        console.log(`File ${fn} did not produce a valid output`);
    }

});