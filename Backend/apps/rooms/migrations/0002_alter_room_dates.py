from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ('rooms', '0001_initial'),
    ]

    operations = [
        migrations.AlterField(
            model_name='room',
            name='start_date',
            field=models.DateTimeField(help_text='게임 시작 일시'),
        ),
        migrations.AlterField(
            model_name='room',
            name='end_date',
            field=models.DateTimeField(help_text='게임 종료 일시'),
        ),
        migrations.AddField(
            model_name='participant',
            name='hexes_claimed',
            field=models.IntegerField(default=0, help_text='점령한 땅 수'),
        ),
        migrations.AddField(
            model_name='participant',
            name='rating_change',
            field=models.IntegerField(default=0, help_text='레이팅 변동'),
        ),
        migrations.AddField(
            model_name='participant',
            name='is_mvp',
            field=models.BooleanField(default=False, help_text='MVP 여부'),
        ),
    ]
