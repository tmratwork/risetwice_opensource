# Create the symlink
cd apps/matching
ln -s ../../src ./src

Removing the symlink:
cd apps/matching
rm src  # Deletes the symlink only
# The real /src directory is completely untouched