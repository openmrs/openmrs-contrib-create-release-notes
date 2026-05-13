import { buildReleaseNote } from '../src/buildReleaseNote'
import { Commit } from '../src/types'

describe('buildReleaseNote', () => {
    test('replaces placeholders with commit values', async () => {
        const commit: Commit = {
            author: 'johnyherangi',
            subject: 'foo',
            commit: 'bar',
        }
        const result = buildReleaseNote('- {{subject}} by @{{author}}', commit)
        expect(result).toMatchInlineSnapshot('"- foo by @johnyherangi"')
    })

    test('replaces placeholders with fallback commit values', async () => {
        const commit: Commit = {
            committer: 'shrekswampman',
            subject: 'foo',
            commit: 'bar',
        }
        const result = buildReleaseNote('- {{subject}} by @{{author|committer}}', commit)
        expect(result).toMatchInlineSnapshot('"- foo by @shrekswampman"')
    })

    test('ignores invalid placeholders', async () => {
        const commit: Commit = {
            author: 'johnyherangi',
            subject: 'foo',
            commit: 'bar',
        }
        const result = buildReleaseNote('- {{invalid}} by @{{author}}', commit)
        expect(result).toMatchInlineSnapshot('"- {{invalid}} by @johnyherangi"')
    })

    test('returns the template unchanged when empty', async () => {
        const commit: Commit = { subject: 'foo' }
        expect(buildReleaseNote('', commit)).toBe('')
    })

    test('returns the template unchanged when it has no placeholders', async () => {
        const commit: Commit = { subject: 'foo' }
        expect(buildReleaseNote('static text', commit)).toBe('static text')
    })

    test('replaces every occurrence of a repeated placeholder', async () => {
        const commit: Commit = { subject: 'foo', author: 'alice' }
        expect(buildReleaseNote('{{author}} and {{author}} again', commit)).toBe(
            'alice and alice again',
        )
    })

    test('leaves the placeholder in place when the value is null and no fallback exists', async () => {
        const commit: Commit = { subject: 'foo', author: null }
        expect(buildReleaseNote('by @{{author}}', commit)).toBe('by @{{author}}')
    })

    test('leaves the placeholder in place when every fallback resolves to a falsy value', async () => {
        const commit: Commit = { subject: 'foo', author: null, committer: undefined }
        expect(buildReleaseNote('by @{{author|committer}}', commit)).toBe(
            'by @{{author|committer}}',
        )
    })

    test('does not match mixed-case or uppercase placeholders', async () => {
        const commit: Commit = { subject: 'foo', author: 'alice' }
        expect(buildReleaseNote('{{Author}} {{AUTHOR}}', commit)).toBe('{{Author}} {{AUTHOR}}')
    })

    test('treats $&, $1, and $$ in values as literal text', async () => {
        const commit: Commit = { subject: 'foo', author: 'pre$&post' }
        expect(buildReleaseNote('{{author}}', commit)).toBe('pre$&post')
    })

    test('preserves $-prefixed sequences from commit messages verbatim', async () => {
        const commit: Commit = { subject: 'fix $1 in regex', author: 'alice' }
        expect(buildReleaseNote('- {{subject}} by @{{author}}', commit)).toBe(
            '- fix $1 in regex by @alice',
        )
    })
})
