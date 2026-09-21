#!/usr/bin/env bash
# Validates the generated samples against FHIR 4.0.1 plus the OAH IG built by build-ig.sh.
# Fails on any error; warnings are listed but allowed.
set -uo pipefail

VALIDATOR_VERSION="${VALIDATOR_VERSION:-6.10.4}"
JAVA_XMX="${JAVA_XMX:-1536m}"
TX="${TX:-n/a}" # offline: external terminologies (UCUM, SNOMED) are not checked

here="$(cd "$(dirname "$0")" && pwd)"
work="$here/.work"
jar="$work/validator_cli-$VALIDATOR_VERSION.jar"
ig="$work/oah/fsh-generated/resources"
samples="$here/samples/generated"
log="$work/validation.log"

fail() { echo "::error title=FHIR validation setup::$1"; echo "$1" >&2; exit 2; }
[[ -d "$ig" ]] || fail "OAH IG not built at $ig (contents of .work/oah: $(ls "$work/oah" 2>&1 | tr '
' ' ' | head -c 300)); run ./build-ig.sh first"
[[ -d "$samples" ]] || fail "No samples in $samples; run: npx tsx validation/generate-samples.ts (from the repo root)"

if [[ ! -f "$jar" ]]; then
  echo "Downloading validator_cli $VALIDATOR_VERSION"
  mkdir -p "$work"
  curl -fsSL --retry 3 -o "$jar.part" \
    "https://github.com/hapifhir/org.hl7.fhir.core/releases/download/$VALIDATOR_VERSION/validator_cli.jar"     || fail "Could not download validator_cli $VALIDATOR_VERSION"
  mv "$jar.part" "$jar"
fi

# Rivulet's own CodeSystem is loaded as a definition too, so its codes are checked.
igs=(-ig "$ig")
for cs in "$samples"/CodeSystem-*.json; do
  [[ -f "$cs" ]] && igs+=(-ig "$cs")
done

java "-Xmx$JAVA_XMX" -jar "$jar" "$samples" \
  -version 4.0.1 "${igs[@]}" -tx "$TX" > "$log" 2>&1
status=$?

# Per file: its summary line, then its errors and warnings (notes stay in the full log).
grep -E '^-- .* -+$|^(Success|\*FAILURE\*):|^ *(Error|Fatal|Warning) @' "$log" \
  | sed -E -e 's/ -+$//' -e "s#$here/##"
errors=$(grep -cE '^ *(Error|Fatal) @' "$log")
warnings=$(grep -cE '^ *Warning @' "$log")
echo
echo "Total: $errors errors, $warnings warnings. Full log: $log"

# On GitHub Actions, surface the first errors as annotations on the run.
if [[ -n "${GITHUB_ACTIONS:-}" ]]; then
  grep -E '^ *(Error|Fatal) @' "$log" | head -8 | while IFS= read -r line; do
    echo "::error title=FHIR validation::${line}"
  done
fi

if [[ $status -ne 0 || $errors -ne 0 ]]; then
  echo "FHIR validation failed (validator exit $status)" >&2
  exit 1
fi
echo "FHIR validation passed"
