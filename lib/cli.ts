import * as fs from "fs";
import * as commandpost from "commandpost";
import * as YAML from "js-yaml";
import { convert } from "./converter";

const pkg = require("../package.json");

interface RootOptions {
    /** @deprecated */
    stdin: boolean;
    output: string[];
    namespace: string[];
    withQuery: boolean;
    sortProps: boolean;
}

const root = commandpost
    .create<RootOptions, { input_filename: string }>("sw2dts [input_filename]")
    .version(pkg.version, "-v, --version")
    .option("-w, --with-query", "With GET query parameters.")
    .option("-s, --sort-props", "Sort type properties order.")
    .option("-o, --output <output_filename>", "Output to file.")
    .option("-n, --namespace <namespace>", "Use namespace.")
    .option("--stdin", "[Deprecated] Input from standard input.")
    .action((opts, args) => {

        // TODO Delete '--stdin' option.
        if (opts.stdin) {
            console.warn("'--stdin' option is deprecated.");
        }
        if (args.input_filename && opts.stdin) {
            process.stderr.write("Invalid parameters!\n");
            process.exit(1);
            return;
        }

        const outputFilename = opts.output[0];
        const promise: Promise<string> = args.input_filename
            ? fromFile(args.input_filename)
            : fromStdin();

        promise.then(input => {
            const namespace = opts.namespace[0];
            const withQuery = opts.withQuery;
            const sortProps = opts.sortProps;
            return convert(YAML.safeLoad(input), { namespace, withQuery, sortProps });
        }).then(model => {
            if (outputFilename) {
                fs.writeFileSync(outputFilename, model);
            } else {
                process.stdout.write(model);
            }
            process.exit(0);
        }).catch(errorHandler);
    });

commandpost
    .exec(root, process.argv)
    .catch(errorHandler);

function fromStdin(): Promise<string> {
    process.stdin.setEncoding("utf-8");
    return new Promise((resolve, reject) => {
        let data = "";
        process.stdin
            .on("data", chunk => data += chunk)
            .once("end", () => resolve(data))
            .once("error", err => reject(err));
        setTimeout(() => {
            if (data) { return; }
            reject();
        }, 1000);
    });
}

function fromFile(inputFileName: string): Promise<string> {
    return new Promise((resolve, reject) => {
        const file = fs.readFileSync(inputFileName, { encoding: "utf-8" });
        resolve(file);
    });
}

function errorHandler(err: Error) {
    if (err == null) {
        process.stdout.write(root.helpText());
        process.exit(0);
        return;
    }
    if (err instanceof Error) {
        console.error(err.stack);
    } else if (err) {
        console.error(err);
    }
    process.exit(1);
}
