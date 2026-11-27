# Deployment

The release workflow builds and signs an immutable GHCR image with
`seheon99/build-and-deploy/build@v1.5.0`. Its `image` job output is passed
to a separate `deploy@v1.5.0` job. Pull requests only build; they do not
publish, sign, or connect to the server.

The deployment directory is `/srv/apps/blog`, with `compose.yaml` and
the server-only `.env`. Install the Compose file from the reviewed release
commit before the first deployment and whenever its configuration changes:

```sh
install -d -m 750 /srv/apps/blog
install -m 644 compose.yaml /srv/apps/blog/compose.yaml
```

Run these commands on the server from a checkout of the reviewed commit.
Keep environment files and credentials on the server; never commit them.
The SSH deployment user must be able to write the deployment directory and
environment file and run Docker. Keep GHCR authentication on the server
if the images are private. The existing `public-traefik-net` must remain;
routing is managed outside this repository.

## Retry and rollback

If the build succeeds and deployment fails, use **Re-run failed jobs**
in the original Actions run. The successful build is not repeated, and
deployment reuses its immutable image output. Re-running all jobs rebuilds.
For a rollback, re-run the deploy job of the desired previous successful
run after checking that its Compose version is compatible.

The deploy action validates a candidate environment with `docker compose
config --quiet` before replacing `.env`. Configuration failure preserves
the previous environment file. Pull/start failure happens after replacement;
the job fails with the candidate digest still recorded, so retry that job.
Only the selected service is updated with `--no-deps --no-build`.

## Move from the shared Compose project

Schedule a short interruption for this one service. The previous shared
file is `/srv/apps/docker-compose.yaml` (also reachable through the
`/srv/services` symlink), with project name `apps`. Do not run `down`,
`--remove-orphans`, or stop the entire shared stack.

1. Back up the shared Compose file and `.env` securely on the server.
2. Install this repository's Compose file as described above. Copy only
   `BLOG_IMAGE_DIGEST` with its current digest into the new environment file:

   ```sh
   (umask 077; grep '^BLOG_IMAGE_DIGEST=' /srv/apps/.env > /srv/apps/blog/.env)
   grep -q '^BLOG_IMAGE_DIGEST=sha256:' /srv/apps/blog/.env
   docker compose --project-directory /srv/apps/blog --env-file /srv/apps/blog/.env -f /srv/apps/blog/compose.yaml config --quiet
   docker compose --project-directory /srv/apps/blog --env-file /srv/apps/blog/.env -f /srv/apps/blog/compose.yaml pull blog
   ```

   Do not overwrite an already migrated environment with this one-time copy.
3. After validation and pull succeed, stop and remove only the old service:

   ```sh
   docker compose --project-directory /srv/apps --env-file /srv/apps/.env -f /srv/apps/docker-compose.yaml stop blog
   docker compose --project-directory /srv/apps --env-file /srv/apps/.env -f /srv/apps/docker-compose.yaml rm -f blog
   docker compose --project-directory /srv/apps/blog --env-file /srv/apps/blog/.env -f /srv/apps/blog/compose.yaml up -d --no-deps --no-build blog
   ```

4. Check the public site and confirm the new container is attached to
   `public-traefik-net`. Then remove only this service definition from the
   shared file so later shared-stack updates cannot recreate it.
5. If the check fails, stop and remove the new project's service and start
   the old service using the backed-up shared configuration and environment.
   Keep the backup until the new release is healthy.
