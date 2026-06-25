# Create Release Notes

This action compiles the commits between the latest release tag and a head ref into release notes. For use with [actions/create-release](https://github.com/actions/create-release).

- If no release tags exist, only the `head-ref` commit will be compiled.

## Inputs

### `base-ref`

**Optional** Explicit base ref/tag for the comparison (e.g. a previous release tag). Default is `''`.

When provided, the action compares `base-ref...head-ref` directly and does not call `getLatestRelease`. When omitted, behavior is unchanged: the latest repo release is used as the base, falling back to a single-commit fetch at `head-ref` if no releases exist.

Callers in multi-artifact repos (where a single repo releases artifacts under different tag prefixes) or releasing from a non-default branch should compute and pass `base-ref` — typically from a prior step's output — because `getLatestRelease` returns the repo-wide latest release, which may belong to an unrelated artifact or branch.

```yaml
- uses: openmrs/openmrs-contrib-create-release-notes@v1
  with:
      head-ref: refs/tags/authentication-2.1.1
      base-ref: refs/tags/authentication-2.1.0
```

### `head-ref`

**Optional** Custom head ref. Default is `HEAD`.

### `format`

**Optional** Release note format. Default is `- {{subject}} by @{{author}}`.

> Usable commit values: `subject`, `author`, `committer` and `message`

Values can also be piped in the event that one commit value is missing e.g.

```
- {{subject}} by @{{author|committer}}
```

## Outputs

### `release-name`

Contains the `subject` of the latest commit in the release notes e.g.

```
Do more stuff (#2)
```

### `release-notes`

Multi-lined release notes e.g.

```
- Do more stuff (#2) by @johnyherangi
- Do stuff (#1) by @johnyherangi
```

## Example usage

```yaml
- uses: https://github.com/openmrs/openmrs-contrib-create-release-notes@main
  id: create-release-notes
  env:
      GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
- uses: actions/create-release@v1
  env:
      GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
  with:
      tag_name: '1.0.0'
      release_name: My Release
      body: ${{ steps.create-release-notes.outputs.release-notes }}
```
