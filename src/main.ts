import { getInput, setFailed, setOutput } from '@actions/core'
import { context, getOctokit } from '@actions/github'
import { buildReleaseNote } from './buildReleaseNote'
import { ApiCommit } from './types'

async function main() {
    try {
        if (process.env.GITHUB_TOKEN === undefined) {
            setFailed('env.GITHUB_TOKEN is not set')
            return
        }

        let baseRef = ''
        const headRef = getInput('head-ref')
        const format = getInput('format')
        const github = getOctokit(process.env.GITHUB_TOKEN)
        const { owner, repo } = context.repo

        const commits: ApiCommit[] = await github.rest.repos.getLatestRelease({ owner, repo }).then(
            (release) => {
                baseRef = release.data.tag_name
                return github.rest.repos
                    .compareCommitsWithBasehead({
                        owner,
                        repo,
                        basehead: `${baseRef}...${headRef}`,
                    })
                    .then((response) => response.data.commits as ApiCommit[])
            },
            () =>
                github.rest.repos
                    .getCommit({ owner, repo, ref: headRef })
                    .then((response) => [response.data as ApiCommit]),
        )

        const mapped = commits
            .map((commit) => ({
                author: commit.author?.login,
                committer: commit.committer?.login,
                subject: commit.commit.message.split('\n')[0],
                message: commit.commit.message,
            }))
            .reverse()

        if (mapped.length === 0) {
            setFailed(`No commits found between refs ${baseRef}...${headRef}`)
            return
        }

        setOutput('release-name', mapped[0].subject)

        let releaseNotes = ''
        for (const commit of mapped) {
            releaseNotes += buildReleaseNote(format, commit)
            releaseNotes += '\n'
        }

        setOutput('release-notes', releaseNotes)
    } catch (error) {
        setFailed(
            typeof error === 'string' || error instanceof Error
                ? error
                : 'An unexpected error occurred.',
        )
    }
}

main()
