const renderer = require('./engine/renderer');

async function testStream() {
    const text = "Sure! Here is a simple `hello world` in python:\n\n```python\nimport os\n\ndef main():\n    print('hello world!')\n\nif __name__ == '__main__':\n    main()\n```\n\nAnd that's it!";

    let current = "";
    let previousLines = 0;

    console.log("Starting stream...");

    for (let char of text) {
        current += char;

        // render
        const rendered = renderer.renderResponse(current);
        const lines = rendered.split('\n');

        // erase previous
        if (previousLines > 0) {
            process.stdout.write(`\x1b[${previousLines}A\x1b[0J`);
        }

        process.stdout.write(rendered + '\n');
        previousLines = lines.length;

        // wait
        await new Promise(r => setTimeout(r, 20)); // 20ms per char
    }
    console.log("Done!");
}

testStream();
