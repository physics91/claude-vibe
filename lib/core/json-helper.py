#!/usr/bin/env python3
"""
JSON Helper for Claude Vibe Plugin
Provides safe JSON encoding/decoding for bash scripts
"""

import sys
import json
import argparse


def encode_analysis(is_ambiguous, score, reasons, questions, prompt):
    """Encode analysis results as JSON"""
    # Validate and convert score to integer
    try:
        score_int = int(score)
    except (ValueError, TypeError) as e:
        print(f"Error: Invalid score value '{score}' - must be a number", file=sys.stderr)
        sys.exit(1)

    data = {
        "is_ambiguous": is_ambiguous == "true",
        "ambiguity_score": score_int,
        "reasons": reasons,
        "questions": questions,
        "original_prompt": prompt
    }
    print(json.dumps(data, ensure_ascii=False, indent=2))


def decode_json(json_str):
    """Decode JSON and output as bash-compatible variables"""
    try:
        data = json.loads(json_str)

        # Output boolean
        print(f"IS_AMBIGUOUS={'true' if data.get('is_ambiguous', False) else 'false'}")

        # Output number
        print(f"AMBIGUITY_SCORE={data.get('ambiguity_score', 0)}")

        # Output array as space-separated values
        reasons = data.get('reasons', [])
        print(f"REASONS={' '.join(reasons)}")

        # Output questions count
        questions = data.get('questions', [])
        print(f"QUESTION_COUNT={len(questions)}")

        # Output each question with index
        for i, question in enumerate(questions):
            # Escape for bash (replace newlines, quotes)
            escaped = question.replace('\\', '\\\\').replace("'", "'\\''").replace('\n', '\\n')
            print(f"QUESTION_{i}='{escaped}'")

        # Output original prompt
        prompt = data.get('original_prompt', '')
        escaped_prompt = prompt.replace('\\', '\\\\').replace("'", "'\\''").replace('\n', '\\n')
        print(f"ORIGINAL_PROMPT='{escaped_prompt}'")

    except json.JSONDecodeError as e:
        print(f"Error: Invalid JSON - {e}", file=sys.stderr)
        sys.exit(1)


def extract_field(json_str, field_name):
    """Extract a single field from JSON"""
    try:
        data = json.loads(json_str)

        # Check if field exists (distinguish from null value)
        if field_name not in data:
            print(f"Error: Field '{field_name}' not found in JSON", file=sys.stderr)
            sys.exit(1)

        value = data[field_name]

        if isinstance(value, bool):
            print('true' if value else 'false')
        elif isinstance(value, (int, float)):
            print(value)
        elif isinstance(value, str):
            print(value)
        elif isinstance(value, list):
            # Output each element on a new line, ensuring valid JSON for complex types
            for item in value:
                if isinstance(item, (dict, list)):
                    print(json.dumps(item))
                else:
                    print(item)
        elif value is None:
            print('null')
        else:
            print(json.dumps(value))

    except json.JSONDecodeError as e:
        print(f"Error: Invalid JSON - {e}", file=sys.stderr)
        sys.exit(1)


def main():
    parser = argparse.ArgumentParser(description='JSON helper for bash scripts')
    subparsers = parser.add_subparsers(dest='command', help='Command to execute')

    # Encode command
    encode_parser = subparsers.add_parser('encode', help='Encode analysis as JSON')
    encode_parser.add_argument('--is-ambiguous', required=True, help='true or false')
    encode_parser.add_argument('--score', required=True, type=int, help='Ambiguity score')
    encode_parser.add_argument('--reasons', nargs='*', default=[], help='List of reasons')
    encode_parser.add_argument('--questions', nargs='*', default=[], help='List of questions')
    encode_parser.add_argument('--prompt', required=True, help='Original prompt')

    # Decode command
    decode_parser = subparsers.add_parser('decode', help='Decode JSON to bash variables')
    decode_parser.add_argument('json_string', nargs='?', help='JSON string to decode')

    # Extract command
    extract_parser = subparsers.add_parser('extract', help='Extract single field from JSON')
    extract_parser.add_argument('field', help='Field name to extract')
    extract_parser.add_argument('json_string', nargs='?', help='JSON string')

    args = parser.parse_args()

    if args.command == 'encode':
        encode_analysis(
            args.is_ambiguous,
            args.score,
            args.reasons,
            args.questions,
            args.prompt
        )
    elif args.command == 'decode':
        json_str = args.json_string or sys.stdin.read()
        decode_json(json_str)
    elif args.command == 'extract':
        json_str = args.json_string or sys.stdin.read()
        extract_field(json_str, args.field)
    else:
        parser.print_help()
        sys.exit(1)


if __name__ == '__main__':
    main()
