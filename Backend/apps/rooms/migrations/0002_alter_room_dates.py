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
    ]
