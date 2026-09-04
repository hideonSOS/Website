from django.core.management.base import BaseCommand
from django.utils import timezone

from website.models import MotorComment


class Command(BaseCommand):
    help = (
        "scheduled_at が空の MotorComment に created_at の日付(ローカル時刻)を補完する。"
        "Excel取込が scheduled_at を保存していなかった時期のデータ救済用。"
    )

    def add_arguments(self, parser):
        parser.add_argument("--dry-run", action="store_true",
                            help="変更せずに対象件数だけ表示する")

    def handle(self, *args, **opts):
        qs = MotorComment.objects.filter(scheduled_at__isnull=True)
        n = qs.count()
        if opts["dry_run"]:
            self.stdout.write(f"対象: {n}件（--dry-run のため変更なし）")
            return
        updated = 0
        for obj in qs:
            obj.scheduled_at = timezone.localtime(obj.created_at).date()
            obj.save(update_fields=["scheduled_at"])
            updated += 1
        self.stdout.write(self.style.SUCCESS(f"{updated}件の scheduled_at を補完しました"))
