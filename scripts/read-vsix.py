import json
import posixpath
import re
import sys
import zipfile


archive, mode = sys.argv[1:]
files = {}
with zipfile.ZipFile(archive) as package:
    manifest = json.loads(package.read("extension/package.json").decode("utf-8-sig"))
    theme_roots = {
        posixpath.dirname(posixpath.normpath("extension/" + theme["path"])) + "/"
        for theme in manifest["contributes"]["themes"]
    }
    for member in package.infolist():
        name = member.filename
        allowed = name == "extension/package.json" or (
            mode == "sources"
            and (
                (
                    re.search(r"\.(?:json|jsonc)$", name, re.I)
                    and any(
                        name.startswith(root) and (
                            root != "extension/" or "/" not in name[len(root):]
                        )
                        for root in theme_roots
                    )
                )
                or re.fullmatch(r"extension/(?:license|notice)[^/]*", name, re.I)
            )
        )
        if allowed:
            if member.file_size > 16 * 1024 * 1024:
                raise ValueError(f"Oversized source: {name}")
            files[name] = package.read(member).decode("utf-8")
print(json.dumps(files))
